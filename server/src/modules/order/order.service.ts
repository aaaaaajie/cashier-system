import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

import { Order, OrderDocument } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { ErrorCode, OrderStatus, ORDER_DEFAULT_EXPIRE_MINUTES } from '../../common/constants';
import { IdGenerator } from '../../common/utils/id-generator.util';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly configService: ConfigService,
  ) {}

  private toCashierUrl(orderId: string): string {
    const base = (this.configService.get<string>('cashierBaseUrl') || '').replace(/\/+$/, '');
    return `${base}/pay/${orderId}`;
  }

  async createOrder(merchantId: string, dto: CreateOrderDto, clientIp?: string) {
    const expireMinutes = dto.expireMinutes ?? ORDER_DEFAULT_EXPIRE_MINUTES;
    const expireAt = new Date(Date.now() + expireMinutes * 60 * 1000);

    const existing = await this.orderModel
      .findOne({ merchantId, externalOrderId: dto.externalOrderId })
      .lean();
    if (existing) {
      const token = await this.issueCashierToken(existing.orderId, existing.merchantId, existing.expireAt);
      return {
        orderId: existing.orderId,
        amount: existing.amount,
        status: existing.status,
        expireAt: existing.expireAt,
        qrcodeUrl: `${this.toCashierUrl(existing.orderId)}?t=${token}`,
        cashierToken: token,
      };
    }

    const orderId = IdGenerator.generateOrderId();

    try {
      const created = await this.orderModel.create({
        orderId,
        merchantId,
        externalOrderId: dto.externalOrderId,
        subject: dto.subject,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency || 'CNY',
        status: OrderStatus.PENDING,
        expireAt,
        metadata: dto.metadata,
        userId: dto.userId,
        notifyUrl: dto.notifyUrl,
        returnUrl: dto.returnUrl,
        clientIp,
      });

      this.logger.log(JSON.stringify({ action: 'order.created', merchantId, orderId }));
      const token = await this.issueCashierToken(created.orderId, created.merchantId, created.expireAt);
      return {
        orderId: created.orderId,
        amount: created.amount,
        status: created.status,
        expireAt: created.expireAt,
        qrcodeUrl: `${this.toCashierUrl(created.orderId)}?t=${token}`,
        cashierToken: token,
      };
    } catch (e: any) {
      // idempotency race: unique(externalOrderId, merchantId)
      if (e?.code === 11000) {
        const dup = await this.orderModel
          .findOne({ merchantId, externalOrderId: dto.externalOrderId })
          .lean();
        if (dup) {
          const token = await this.issueCashierToken(dup.orderId, dup.merchantId, dup.expireAt);
          return {
            orderId: dup.orderId,
            amount: dup.amount,
            status: dup.status,
            expireAt: dup.expireAt,
            qrcodeUrl: `${this.toCashierUrl(dup.orderId)}?t=${token}`,
            cashierToken: token,
          };
        }
      }
      throw e;
    }
  }

  async issueCashierToken(orderId: string, merchantId: string, expireAt: Date): Promise<string> {
    const token = crypto.randomBytes(16).toString('hex');
    const ttlSeconds = Math.max(60, Math.floor((expireAt.getTime() - Date.now()) / 1000));
    await this.redis.setex(`CASHIER_TOKEN:${token}`, ttlSeconds, JSON.stringify({ orderId, merchantId }));
    return token;
  }

  async getOrderAny(orderId: string) {
    const order = await this.orderModel.findOne({ orderId }).lean();
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    return order;
  }

  async getOrder(merchantId: string, orderId: string) {
    const order = await this.orderModel.findOne({ merchantId, orderId }).lean();
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    return order;
  }

  async listOrders(merchantId: string, query: QueryOrderDto) {
    const filter: any = { merchantId };
    if (query.status) filter.status = query.status;
    if (query.externalOrderId) filter.externalOrderId = query.externalOrderId;
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, data] = await Promise.all([
      this.orderModel.countDocuments(filter),
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return { total, page, pageSize, data };
  }

  async closeOrder(merchantId: string, orderId: string) {
    const order = await this.orderModel.findOne({ merchantId, orderId });
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    if (![OrderStatus.PENDING, OrderStatus.PAYING].includes(order.status)) {
      throw new HttpException(
        { code: ErrorCode.ORDER_STATUS_INVALID, message: '订单状态不允许关闭' },
        HttpStatus.BAD_REQUEST,
      );
    }
    order.status = OrderStatus.CLOSED;
    await order.save();
    this.logger.log(JSON.stringify({ action: 'order.closed', merchantId, orderId }));
    return { orderId, status: order.status };
  }

  async expireDueOrders(): Promise<number> {
    const now = new Date();
    const res = await this.orderModel.updateMany(
      { status: OrderStatus.PENDING, expireAt: { $lt: now } },
      { $set: { status: OrderStatus.EXPIRED } },
    );
    return (res as any).modifiedCount ?? (res as any).nModified ?? 0;
  }
}
