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
export class AlipayChannel implements IPaymentChannel {
  private readonly logger = new Logger(AlipayChannel.name);

  async createPayment(params: CreatePaymentParams, config: any): Promise<PaymentResult> {
    this.logger.log(`[MOCK] Alipay createPayment: orderId=${params.orderId}, amount=${params.amount}`);

    const channelOrderId = `ali_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

    return {
      success: true,
      channelOrderId,
      payUrl: `https://mock-alipay.example.com/pay/${channelOrderId}`,
      qrcodeUrl: `https://mock-alipay.example.com/qr/${channelOrderId}`,
    };
  }

  async queryPayment(channelOrderId: string, config: any): Promise<PaymentStatusResult> {
    this.logger.log(`[MOCK] Alipay queryPayment: channelOrderId=${channelOrderId}`);
    return {
      paid: true,
      channelOrderId,
      amount: 0,
    };
  }

  async refund(params: RefundParams, config: any): Promise<RefundResult> {
    this.logger.log(`[MOCK] Alipay refund: refundId=${params.refundId}, amount=${params.refundAmount}`);
    return {
      success: true,
      channelRefundId: `ali_ref_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
    };
  }

  verifyCallback(rawBody: Buffer, headers: Record<string, string>, config: any): boolean {
    this.logger.log('[MOCK] Alipay verifyCallback: always returns true');
    return true;
  }

  parseCallback(rawBody: Buffer, headers: Record<string, string>): CallbackData {
    const body = JSON.parse(rawBody.toString());
    return {
      channelOrderId: body.channelOrderId || `ali_mock_${Date.now()}`,
      orderId: body.orderId || '',
      amount: body.amount || 0,
      success: body.success !== false,
      rawData: body,
    };
  }
}
