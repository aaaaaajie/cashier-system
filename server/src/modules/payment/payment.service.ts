import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import Redis from 'ioredis';

import { Order, OrderDocument } from '../order/order.schema';
import { OrderService } from '../order/order.service';
import { Payment, PaymentDocument } from './payment.schema';
import { Merchant, MerchantDocument } from '../merchant/merchant.schema';
import {
  ErrorCode,
  OrderStatus,
  PaymentChannel,
  PaymentMethod,
  PaymentStatus,
} from '../../common/constants';
import { IdGenerator } from '../../common/utils/id-generator.util';
import { ChannelFactory } from './channels/channel.factory';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Merchant.name) private readonly merchantModel: Model<MerchantDocument>,
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly channelFactory: ChannelFactory,
    private readonly notificationService: NotificationService,
  ) {}

  private toCashierUrl(orderId: string): string {
    const base = (this.configService.get<string>('cashierBaseUrl') || '').replace(/\/+$/, '');
    return `${base}/pay/${orderId}`;
  }

  async getUnifiedQrcode(merchantId: string, orderId: string) {
    const order = await this.orderModel.findOne({ merchantId, orderId }).lean();
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    const token = await this.orderService.issueCashierToken(order.orderId, order.merchantId, order.expireAt);
    const url = `${this.toCashierUrl(orderId)}?t=${token}`;
    return {
      qrcodeUrl: url,
      qrcodeData: url,
      cashierToken: token,
      expireAt: order.expireAt,
    };
  }

  private async acquirePayLock(orderId: string): Promise<boolean> {
    const key = `LOCK:PAY:${orderId}`;
    const result = await this.redis.set(key, '1', 'EX', 30, 'NX');
    return result === 'OK';
  }

  private async releasePayLock(orderId: string) {
    const key = `LOCK:PAY:${orderId}`;
    await this.redis.del(key);
  }

  private decryptMerchantConfig(merchant: any) {
    const masterKey = this.configService.get<string>('masterEncryptionKey')!;
    const cfg = merchant.paymentConfig || {};
    const wechat = cfg.wechat
      ? {
          ...cfg.wechat,
          apiKeyV3: cfg.wechat.apiKeyV3 ? CryptoUtil.decrypt(cfg.wechat.apiKeyV3, masterKey) : undefined,
          privateKey: cfg.wechat.privateKey ? CryptoUtil.decrypt(cfg.wechat.privateKey, masterKey) : undefined,
        }
      : undefined;
    const alipay = cfg.alipay
      ? {
          ...cfg.alipay,
          privateKey: cfg.alipay.privateKey ? CryptoUtil.decrypt(cfg.alipay.privateKey, masterKey) : undefined,
        }
      : undefined;
    return { ...cfg, wechat, alipay };
  }

  private detectChannelFromHints(hints: { ua?: string; channelHint?: string }): PaymentChannel {
    const hint = (hints.channelHint || '').toLowerCase();
    if (hint === PaymentChannel.WECHAT || hint === 'wx') return PaymentChannel.WECHAT;
    if (hint === PaymentChannel.ALIPAY || hint === 'ali') return PaymentChannel.ALIPAY;

    const ua = (hints.ua || '').toLowerCase();
    if (ua.includes('micromessenger')) return PaymentChannel.WECHAT;
    if (ua.includes('alipay')) return PaymentChannel.ALIPAY;
    return PaymentChannel.ALIPAY;
  }

  async createJsapiPayment(merchantId: string, orderId: string, openId: string, clientIp?: string) {
    return this.createChannelPayment({
      merchantId,
      orderId,
      channel: PaymentChannel.WECHAT,
      method: PaymentMethod.JSAPI,
      openId,
      clientIp,
    });
  }

  async createH5Payment(
    merchantId: string,
    orderId: string,
    hints: { ua?: string; channelHint?: string },
    clientIp?: string,
  ) {
    const channel = this.detectChannelFromHints(hints);
    return this.createChannelPayment({
      merchantId,
      orderId,
      channel,
      method: PaymentMethod.H5,
      clientIp,
    });
  }

  async getPaymentDetail(merchantId: string, paymentId: string) {
    const payment = await this.paymentModel.findOne({ merchantId, paymentId }).lean();
    if (!payment) {
      throw new HttpException({ code: ErrorCode.PARAM_VALIDATION_FAILED, message: '支付单不存在' }, HttpStatus.NOT_FOUND);
    }
    const order = await this.orderModel.findOne({ merchantId, orderId: payment.orderId }).lean();
    return {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      status: payment.status,
      channel: payment.channel,
      method: payment.method,
      amount: payment.amount,
      channelTransactionId: payment.channelTransactionId || null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      order: order
        ? {
            externalOrderId: order.externalOrderId,
            subject: order.subject,
            status: order.status,
            paidAt: order.paidAt || null,
          }
        : null,
    };
  }
  private async createChannelPayment(params: {
    merchantId: string;
    orderId: string;
    channel: PaymentChannel;
    method: PaymentMethod;
    openId?: string;
    clientIp?: string;
  }) {
    const locked = await this.acquirePayLock(params.orderId);
    if (!locked) {
      throw new HttpException(
        { code: ErrorCode.ORDER_STATUS_INVALID, message: '订单正在支付中，请稍后重试' },
        HttpStatus.CONFLICT,
      );
    }

    try {
      const order = await this.orderModel.findOne({ merchantId: params.merchantId, orderId: params.orderId });
      if (!order) {
        throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
      }
      if (order.status === OrderStatus.PAID) {
        throw new HttpException({ code: ErrorCode.ORDER_STATUS_INVALID, message: '订单已支付' }, HttpStatus.BAD_REQUEST);
      }
      if (order.status === OrderStatus.EXPIRED || order.expireAt.getTime() < Date.now()) {
        throw new HttpException({ code: ErrorCode.ORDER_EXPIRED, message: '订单已过期' }, HttpStatus.BAD_REQUEST);
      }

      const merchant = await this.merchantModel.findOne({ merchantId: params.merchantId }).lean();
      if (!merchant) {
        throw new HttpException({ code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在' }, HttpStatus.NOT_FOUND);
      }

      const paymentConfig = this.decryptMerchantConfig(merchant);
      if (params.channel === PaymentChannel.WECHAT && !paymentConfig.wechat) {
        throw new HttpException(
          { code: ErrorCode.CHANNEL_NOT_CONFIGURED, message: '商户未配置微信支付' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (params.channel === PaymentChannel.ALIPAY && !paymentConfig.alipay) {
        throw new HttpException(
          { code: ErrorCode.CHANNEL_NOT_CONFIGURED, message: '商户未配置支付宝' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const channelImpl = this.channelFactory.getChannel(params.channel);
      const channelResult = await channelImpl.createPayment(
        {
          orderId: order.orderId,
          amount: order.amount,
          subject: order.subject,
          notifyUrl: order.notifyUrl || merchant.callbackUrl || '',
          returnUrl: order.returnUrl,
          clientIp: params.clientIp,
          openId: params.openId,
        },
        paymentConfig[params.channel],
      );

      if (!channelResult.success) {
        throw new HttpException(
          { code: ErrorCode.CHANNEL_CALL_FAILED, message: channelResult.errorMessage || '渠道下单失败' },
          HttpStatus.BAD_GATEWAY,
        );
      }

      const paymentId = IdGenerator.generatePaymentId();
      await this.paymentModel.create({
        paymentId,
        orderId: order.orderId,
        merchantId: params.merchantId,
        channel: params.channel,
        method: params.method,
        amount: order.amount,
        status: PaymentStatus.PENDING,
        channelResponse: channelResult,
        channelTransactionId: channelResult.channelOrderId,
      });

      await this.orderModel.updateOne(
        { _id: order._id },
        {
          $set: {
            status: OrderStatus.PAYING,
            paymentChannel: params.channel,
            paymentMethod: params.method,
            channelOrderId: channelResult.channelOrderId,
          },
        },
      );

      this.logger.log(
        JSON.stringify({
          action: 'payment.created',
          merchantId: params.merchantId,
          orderId: order.orderId,
          channel: params.channel,
          method: params.method,
        }),
      );

      return {
        orderId: order.orderId,
        paymentId,
        channel: params.channel,
        method: params.method,
        payUrl: channelResult.payUrl,
        qrcodeUrl: channelResult.qrcodeUrl || this.toCashierUrl(order.orderId),
        prepayData: channelResult.prepayData,
      };
    } finally {
      await this.releasePayLock(params.orderId).catch(() => undefined);
    }
  }

  async handleChannelCallback(channel: PaymentChannel, rawBody: Buffer, headers: Record<string, string>): Promise<boolean> {
    const channelImpl = this.channelFactory.getChannel(channel);

    // Parse first to locate order and merchant config
    const data = channelImpl.parseCallback(rawBody, headers);
    if (!data.orderId) {
      this.logger.warn(JSON.stringify({ action: 'callback.missing_order', channel }));
      return false;
    }

    const order = await this.orderModel.findOne({ orderId: data.orderId });
    if (!order) {
      this.logger.warn(JSON.stringify({ action: 'callback.order_not_found', channel, orderId: data.orderId }));
      return false;
    }

    const merchant = await this.merchantModel.findOne({ merchantId: order.merchantId }).lean();
    if (!merchant) return false;

    const paymentConfig = this.decryptMerchantConfig(merchant);
    const verified = channelImpl.verifyCallback(rawBody, headers, paymentConfig[channel]);
    if (!verified) return false;

    if (!data.success) {
      await this.paymentModel.updateOne(
        { orderId: order.orderId, channel },
        { $set: { status: PaymentStatus.FAILED, failReason: 'channel_callback_failed' } },
      );
      return true;
    }

    if (order.status === OrderStatus.PAID) {
      return true;
    }

    const paidAt = new Date();
    await Promise.all([
      this.orderModel.updateOne(
        { _id: order._id, status: { $ne: OrderStatus.PAID } },
        {
          $set: {
            status: OrderStatus.PAID,
            paymentChannel: channel,
            channelOrderId: data.channelOrderId,
            paidAt,
          },
        },
      ),
      this.paymentModel.updateOne(
        { orderId: order.orderId, channelTransactionId: data.channelOrderId },
        {
          $set: {
            status: PaymentStatus.SUCCESS,
            paidAt,
            channelTransactionId: data.channelOrderId,
          },
        },
      ),
    ]);

    this.logger.log(JSON.stringify({ action: 'payment.callback.success', orderId: order.orderId, channel }));
    await this.notificationService.enqueuePaymentNotify(order.orderId);
    return true;
  }
}
