import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentChannel,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  RefundParams,
  RefundResult,
  CallbackData,
} from './channel.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WechatPayChannel implements IPaymentChannel {
  private readonly logger = new Logger(WechatPayChannel.name);

  async createPayment(params: CreatePaymentParams, config: any): Promise<PaymentResult> {
    this.logger.log(`[MOCK] WeChat createPayment: orderId=${params.orderId}, amount=${params.amount}`);

    // Mock: simulate successful payment creation
    const channelOrderId = `wx_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

    return {
      success: true,
      channelOrderId,
      qrcodeUrl: `https://mock-wechat-pay.example.com/qr/${channelOrderId}`,
      prepayData: {
        prepay_id: `wx_prepay_${channelOrderId}`,
        appId: config?.appId || 'mock_app_id',
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: uuidv4().replace(/-/g, ''),
        package: `prepay_id=wx_prepay_${channelOrderId}`,
        signType: 'RSA',
        paySign: 'mock_sign_value',
      },
    };
  }

  async queryPayment(channelOrderId: string, config: any): Promise<PaymentStatusResult> {
    this.logger.log(`[MOCK] WeChat queryPayment: channelOrderId=${channelOrderId}`);
    return {
      paid: true,
      channelOrderId,
      amount: 0, // In real impl, would return actual amount
    };
  }

  async refund(params: RefundParams, config: any): Promise<RefundResult> {
    this.logger.log(`[MOCK] WeChat refund: refundId=${params.refundId}, amount=${params.refundAmount}`);
    return {
      success: true,
      channelRefundId: `wx_ref_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
    };
  }

  verifyCallback(rawBody: Buffer, headers: Record<string, string>, config: any): boolean {
    this.logger.log('[MOCK] WeChat verifyCallback: always returns true');
    return true;
  }

  parseCallback(rawBody: Buffer, headers: Record<string, string>): CallbackData {
    const body = JSON.parse(rawBody.toString());
    return {
      channelOrderId: body.channelOrderId || `wx_mock_${Date.now()}`,
      orderId: body.orderId || '',
      amount: body.amount || 0,
      success: body.success !== false,
      rawData: body,
    };
  }
}
