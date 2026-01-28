export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  subject: string;
  notifyUrl: string;
  returnUrl?: string;
  clientIp?: string;
  openId?: string;
}

export interface PaymentResult {
  success: boolean;
  channelOrderId?: string;
  payUrl?: string;
  qrcodeUrl?: string;
  prepayData?: Record<string, any>;
  errorMessage?: string;
}

export interface PaymentStatusResult {
  paid: boolean;
  channelOrderId: string;
  amount: number;
}

export interface RefundParams {
  refundId: string;
  channelOrderId: string;
  totalAmount: number;
  refundAmount: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  channelRefundId?: string;
  errorMessage?: string;
}

export interface CallbackData {
  channelOrderId: string;
  orderId: string;
  amount: number;
  success: boolean;
  rawData: Record<string, any>;
}

export interface IPaymentChannel {
  createPayment(params: CreatePaymentParams, config: any): Promise<PaymentResult>;
  queryPayment(channelOrderId: string, config: any): Promise<PaymentStatusResult>;
  refund(params: RefundParams, config: any): Promise<RefundResult>;
  verifyCallback(rawBody: Buffer, headers: Record<string, string>, config: any): boolean;
  parseCallback(rawBody: Buffer, headers: Record<string, string>): CallbackData;
}
