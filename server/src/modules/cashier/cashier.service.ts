import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { CashierPayDto } from './dto/cashier-pay.dto';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import { ErrorCode, OrderStatus, PaymentChannel } from '../../common/constants';

@Injectable()
export class CashierService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  private tokenKey(token: string) {
    return `CASHIER_TOKEN:${token}`;
  }

  private async verifyToken(orderId: string, token: string): Promise<{ merchantId: string }> {
    if (!token) {
      throw new HttpException({ code: ErrorCode.SIGN_VERIFY_FAILED, message: '缺少 token' }, HttpStatus.UNAUTHORIZED);
    }
    const raw = await this.redis.get(this.tokenKey(token));
    if (!raw) {
      throw new HttpException({ code: ErrorCode.SIGN_VERIFY_FAILED, message: 'token 无效或已过期' }, HttpStatus.UNAUTHORIZED);
    }
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new HttpException({ code: ErrorCode.SIGN_VERIFY_FAILED, message: 'token 无效' }, HttpStatus.UNAUTHORIZED);
    }
    if (data.orderId !== orderId) {
      throw new HttpException({ code: ErrorCode.SIGN_VERIFY_FAILED, message: 'token 与订单不匹配' }, HttpStatus.UNAUTHORIZED);
    }
    return { merchantId: data.merchantId };
  }

  async getOrderForCashier(orderId: string, token: string) {
    await this.verifyToken(orderId, token);
    const order = await this.orderService.getOrderAny(orderId);
    return {
      orderId: order.orderId,
      externalOrderId: order.externalOrderId,
      subject: order.subject,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      expireAt: order.expireAt,
      paidAt: order.paidAt || null,
      paymentChannel: order.paymentChannel || null,
      paymentMethod: order.paymentMethod || null,
      channelOrderId: order.channelOrderId || null,
      returnUrl: order.returnUrl || null,
      metadata: order.metadata || null,
    };
  }

  private detectEnv(ua: string): 'wechat' | 'alipay' | 'browser' {
    const s = (ua || '').toLowerCase();
    if (s.includes('micromessenger')) return 'wechat';
    if (s.includes('alipay')) return 'alipay';
    return 'browser';
  }

  async createPayment(dto: CashierPayDto, ctx: { clientIp?: string; ua?: string }) {
    const { merchantId } = await this.verifyToken(dto.orderId, dto.token);
    const order = await this.orderService.getOrder(merchantId, dto.orderId);
    if (order.status === OrderStatus.PAID) {
      return { orderId: dto.orderId, status: OrderStatus.PAID };
    }

    const env = this.detectEnv(ctx.ua || '');
    const channel: PaymentChannel =
      dto.channel ||
      (env === 'wechat' ? PaymentChannel.WECHAT : env === 'alipay' ? PaymentChannel.ALIPAY : PaymentChannel.ALIPAY);

    if (channel === PaymentChannel.WECHAT) {
      if (!dto.openId) {
        throw new HttpException(
          { code: ErrorCode.PARAM_VALIDATION_FAILED, message: '微信支付需要 openId（demo 环境可手动填写）' },
          HttpStatus.BAD_REQUEST,
        );
      }
      return this.paymentService.createJsapiPayment(merchantId, dto.orderId, dto.openId, ctx.clientIp);
    }

    // Alipay defaults to H5
    return this.paymentService.createH5Payment(
      merchantId,
      dto.orderId,
      { ua: ctx.ua, channelHint: dto.channel || channel },
      ctx.clientIp,
    );
  }
}
