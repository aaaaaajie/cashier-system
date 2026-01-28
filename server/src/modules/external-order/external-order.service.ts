import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Order, OrderDocument } from '../order/order.schema';
import { Merchant, MerchantDocument } from '../merchant/merchant.schema';
import { ErrorCode } from '../../common/constants';
import { OrderService } from '../order/order.service';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { SignUtil } from '../../common/utils/sign.util';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class ExternalOrderService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Merchant.name) private readonly merchantModel: Model<MerchantDocument>,
    private readonly configService: ConfigService,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  private cashierExternalUrl(merchantId: string, externalOrderId: string): string {
    const base = (this.configService.get<string>('cashierBaseUrl') || '').replace(/\/+$/, '');
    return `${base}/external?merchantId=${encodeURIComponent(merchantId)}&externalOrderId=${encodeURIComponent(externalOrderId)}`;
  }

  private decryptSharedSecret(merchant: MerchantDocument): string {
    const masterKey = this.configService.get<string>('masterEncryptionKey')!;
    if (!merchant.externalConfig?.sharedSecret) {
      throw new HttpException(
        { code: ErrorCode.PARAM_VALIDATION_FAILED, message: '外部系统配置缺失 sharedSecret' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return CryptoUtil.decrypt(merchant.externalConfig.sharedSecret, masterKey);
  }

  private decryptAppSecret(merchant: MerchantDocument): string | undefined {
    const masterKey = this.configService.get<string>('masterEncryptionKey')!;
    if (!merchant.externalConfig?.appSecret) return undefined;
    return CryptoUtil.decrypt(merchant.externalConfig.appSecret, masterKey);
  }

  private verifyExternalSignature(payload: any, signature: string, merchant: MerchantDocument) {
    const secret = this.decryptSharedSecret(merchant);
    const timestamp = payload?.timestamp || '';
    const nonce = payload?.nonce || '';
    if (!timestamp || !nonce) {
      throw new HttpException(
        { code: ErrorCode.SIGN_VERIFY_FAILED, message: '缺少签名时间戳或随机串' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const params = { ...payload };
    delete params.signature;
    delete params.timestamp;
    delete params.nonce;
    const ok = SignUtil.verifySignature(params, String(timestamp), String(nonce), secret, signature);
    if (!ok) {
      throw new HttpException(
        { code: ErrorCode.SIGN_VERIFY_FAILED, message: '外部系统签名验证失败' },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private async fetchExternalOrderDetail(merchant: MerchantDocument, orderId: string) {
    const cfg = merchant.externalConfig;
    if (!cfg?.baseUrl) {
      throw new HttpException(
        { code: ErrorCode.PARAM_VALIDATION_FAILED, message: '商户未配置外部系统地址' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const pathTemplate = cfg.orderDetailPath || '/api/orders/:orderId';
    const path = pathTemplate.replace(':orderId', encodeURIComponent(orderId));
    const url = `${cfg.baseUrl.replace(/\/+$/, '')}${path}`;

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (cfg.appKey) headers['x-external-app-key'] = cfg.appKey;
    if (cfg.appSecret) headers['x-external-app-secret'] = this.decryptAppSecret(merchant) || '';

    const res = await fetch(url, { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new HttpException(
        { code: ErrorCode.CHANNEL_CALL_FAILED, message: `外部系统拉单失败: ${JSON.stringify(data)}` },
        HttpStatus.BAD_GATEWAY,
      );
    }
    return data;
  }

  private normalizeExternalOrder(raw: any) {
    if (!raw || typeof raw !== 'object') {
      throw new HttpException(
        { code: ErrorCode.PARAM_VALIDATION_FAILED, message: '外部订单数据为空' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!raw.orderId) {
      throw new HttpException(
        { code: ErrorCode.PARAM_VALIDATION_FAILED, message: '外部订单缺少 orderId' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!raw.amount || Number(raw.amount) <= 0) {
      throw new HttpException(
        { code: ErrorCode.PARAM_VALIDATION_FAILED, message: '外部订单金额非法' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      orderId: String(raw.orderId),
      amount: Number(raw.amount),
      currency: raw.currency || 'CNY',
      subject: raw.subject || `业务订单 ${raw.orderId}`,
      description: raw.description || raw.subject || `业务订单 ${raw.orderId}`,
      expireMinutes: raw.expireMinutes ?? 30,
      returnUrl: raw.returnUrl || '',
      notifyUrl: raw.notifyUrl || '',
      metadata: raw.metadata || {},
      items: Array.isArray(raw.items) ? raw.items : [],
      timestamp: raw.timestamp,
      nonce: raw.nonce,
      signature: raw.signature,
    };
  }

  async prepareExternalPayment(merchantId: string, orderId: string) {
    const merchant = await this.merchantModel.findOne({ merchantId });
    if (!merchant) {
      throw new HttpException({ code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在' }, HttpStatus.NOT_FOUND);
    }

    const externalRaw = await this.fetchExternalOrderDetail(merchant, orderId);
    const normalized = this.normalizeExternalOrder(externalRaw);
    this.verifyExternalSignature(normalized, normalized.signature, merchant);

    let order = await this.orderModel.findOne({ merchantId, externalOrderId: normalized.orderId }).lean();
    if (!order) {
      await this.orderService.createOrder(merchantId, {
        externalOrderId: normalized.orderId,
        subject: normalized.subject,
        description: normalized.description,
        amount: normalized.amount,
        currency: normalized.currency,
        expireMinutes: normalized.expireMinutes,
        notifyUrl: normalized.notifyUrl || merchant.callbackUrl,
        returnUrl: normalized.returnUrl,
        metadata: {
          ...(normalized.metadata || {}),
          items: normalized.items,
        },
      });
      order = await this.orderModel.findOne({ merchantId, externalOrderId: normalized.orderId }).lean();
    }

    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单创建失败' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const token = await this.orderService.issueCashierToken(order.orderId, merchantId, order.expireAt);

    return {
      orderId: order.orderId,
      externalOrderId: normalized.orderId,
      subject: order.subject,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      expireAt: order.expireAt,
      cashierToken: token,
      returnUrl: order.returnUrl || null,
      metadata: order.metadata || null,
      cashierUrl: this.cashierExternalUrl(merchantId, normalized.orderId),
    };
  }

  async createCashierPayment(orderId: string, channelHint?: string, ua?: string, clientIp?: string) {
    const order = await this.orderModel.findOne({ orderId }).lean();
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    const hint = channelHint || 'alipay';
    return this.paymentService.createH5Payment(order.merchantId, orderId, { ua, channelHint: hint }, clientIp);
  }
}
