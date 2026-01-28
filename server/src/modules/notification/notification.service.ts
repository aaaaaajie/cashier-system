import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { Writer } from 'nsqjs';

import { NotificationLog, NotificationLogDocument } from './notification-log.schema';
import { Order, OrderDocument } from '../order/order.schema';
import { Merchant, MerchantDocument } from '../merchant/merchant.schema';
import { MAX_RETRY_ATTEMPTS, NotifyStatus, RETRY_DELAYS } from '../../common/constants';

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private writer: Writer | null = null;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel(NotificationLog.name) private readonly logModel: Model<NotificationLogDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Merchant.name) private readonly merchantModel: Model<MerchantDocument>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<boolean>('nsq.enabled') ?? false;
    if (!enabled) return;

    try {
      const host = this.configService.get<string>('nsq.host')!;
      const port = this.configService.get<number>('nsq.port')!;
      const writer = new Writer(host, port);
      writer.on('error', (err: Error) => {
        this.logger.warn(JSON.stringify({ action: 'nsq.writer_error', message: err?.message }));
      });
      writer.connect();
      this.writer = writer;
    } catch (e: any) {
      this.logger.warn(JSON.stringify({ action: 'nsq.writer_init_failed', message: e?.message }));
      this.writer = null;
    }
  }

  onModuleDestroy() {
    try {
      this.writer?.close();
    } catch {
      // ignore
    }
  }

  private async publish(topic: string, payload: any) {
    if (!this.writer) return;
    try {
      this.writer.publish(topic, JSON.stringify(payload));
    } catch (e: any) {
      this.logger.warn(JSON.stringify({ action: 'nsq.publish_failed', topic, message: e?.message }));
    }
  }

  async enqueuePaymentNotify(orderId: string) {
    const order = await this.orderModel.findOne({ orderId }).lean();
    if (!order) return;

    const merchant = await this.merchantModel.findOne({ merchantId: order.merchantId }).lean();
    if (!merchant) return;

    const url = order.notifyUrl || merchant.callbackUrl;
    if (!url) {
      this.logger.warn(JSON.stringify({ action: 'notify.no_url', orderId, merchantId: order.merchantId }));
      return;
    }

    const payload = {
      merchantId: order.merchantId,
      orderId: order.orderId,
      externalOrderId: order.externalOrderId,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      paymentChannel: order.paymentChannel,
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
      metadata: order.metadata || null,
    };

    const log = await this.logModel.create({
      orderId: order.orderId,
      merchantId: order.merchantId,
      url,
      payload,
      attempt: 1,
      status: NotifyStatus.PENDING,
      nextRetryAt: new Date(),
    });

    await this.publish('payment_notify', { notificationLogId: log._id.toString() });
    this.logger.log(JSON.stringify({ action: 'notify.enqueued', orderId, notificationLogId: log._id.toString() }));
  }

  private nextRetryAt(attempt: number): Date | undefined {
    if (attempt >= MAX_RETRY_ATTEMPTS) return undefined;
    const delay = RETRY_DELAYS[Math.max(0, attempt - 1)] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
    return new Date(Date.now() + delay);
  }

  private async sendOnce(url: string, payload: any): Promise<{ ok: boolean; status?: number; body?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await res.text().catch(() => '');
      return { ok: res.ok, status: res.status, body: text?.slice(0, 2000) };
    } catch (e: any) {
      return { ok: false, status: 0, body: e?.message || 'fetch_failed' };
    } finally {
      clearTimeout(timeout);
    }
  }

  async processDueNotifications(limit: number): Promise<number> {
    const now = new Date();
    const due = await this.logModel
      .find({ status: NotifyStatus.PENDING, nextRetryAt: { $lte: now } })
      .sort({ nextRetryAt: 1 })
      .limit(limit)
      .lean();

    let processed = 0;
    for (const log of due) {
      processed += 1;
      await this.processOne(log._id, log.url, log.payload, log.attempt).catch(() => undefined);
    }
    return processed;
  }

  private async processOne(id: Types.ObjectId, url: string, payload: any, attempt: number) {
    // prevent concurrent workers from processing same log
    const lockKey = `LOCK:NOTIFY:${id.toString()}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
    if (locked !== 'OK') return;

    try {
      const res = await this.sendOnce(url, payload);
      if (res.ok) {
        await this.logModel.updateOne(
          { _id: id },
          {
            $set: {
              status: NotifyStatus.SUCCESS,
              responseStatus: res.status,
              responseBody: res.body,
              nextRetryAt: null,
            },
          },
        );
        return;
      }

      const nextAttempt = attempt + 1;
      const nextAt = this.nextRetryAt(nextAttempt);
      await this.logModel.updateOne(
        { _id: id },
        {
          $set: {
            responseStatus: res.status,
            responseBody: res.body,
            attempt: nextAttempt,
            status: nextAt ? NotifyStatus.PENDING : NotifyStatus.FAILED,
            nextRetryAt: nextAt || null,
          },
        },
      );
    } finally {
      await this.redis.del(lockKey).catch(() => undefined);
    }
  }
}

