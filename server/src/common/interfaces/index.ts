export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T | null;
  traceId: string;
}

export interface PagedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  data: T[];
}

export interface PaysetResult {
  total: number;
  fieldset: FieldDef[];
  dataset: Record<string, any>[];
}

export interface FieldDef {
  field: string;
  label: string;
  type: string;
}

export interface CreatePaymentParams {
  orderId: string;
  merchantId: string;
  amount: number;
  subject: string;
  channel: string;
  method: string;
  notifyUrl: string;
  returnUrl?: string;
  clientIp?: string;
}

export interface PaymentResult {
  success: boolean;
  channelOrderId?: string;
  payUrl?: string;
  qrcodeUrl?: string;
  prepayData?: Record<string, any>;
  errorMessage?: string;
}

export interface CallbackData {
  channelOrderId: string;
  orderId: string;
  amount: number;
  status: 'success' | 'failed';
  rawData: Record<string, any>;
}

export interface RefundParams {
  orderId: string;
  refundId: string;
  amount: number;
  reason: string;
  channelOrderId: string;
}

export interface RefundResult {
  success: boolean;
  channelRefundId?: string;
  errorMessage?: string;
}
