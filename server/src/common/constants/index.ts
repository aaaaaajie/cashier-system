// 错误码
export enum ErrorCode {
  SUCCESS = 0,
  // 通用
  SIGN_VERIFY_FAILED = 10001,
  PARAM_VALIDATION_FAILED = 10002,
  MERCHANT_NOT_FOUND = 10003,
  IP_NOT_IN_WHITELIST = 10004,
  RATE_LIMIT_EXCEEDED = 10005,
  TIMESTAMP_EXPIRED = 10006,
  NONCE_DUPLICATED = 10007,
  // 订单
  ORDER_NOT_FOUND = 20001,
  ORDER_EXPIRED = 20002,
  ORDER_STATUS_INVALID = 20003,
  ORDER_DUPLICATE = 20004,
  // 支付
  CHANNEL_CALL_FAILED = 30001,
  CALLBACK_SIGN_FAILED = 30002,
  CHANNEL_NOT_SUPPORTED = 30003,
  CHANNEL_NOT_CONFIGURED = 30004,
  // 退款
  REFUND_AMOUNT_EXCEEDED = 40001,
  REFUND_CHANNEL_FAILED = 40002,
  ORDER_NOT_PAID = 40003,
  // 发票
  INVOICE_NOT_FOUND = 50001,
  INVOICE_STATUS_INVALID = 50002,
  // 对公打款
  TRANSFER_NOT_FOUND = 60001,
  TRANSFER_STATUS_INVALID = 60002,
}

export enum OrderStatus {
  PENDING = 'pending',
  PAYING = 'paying',
  PAID = 'paid',
  REFUNDING = 'refunding',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
  EXPIRED = 'expired',
}

export enum PaymentChannel {
  WECHAT = 'wechat',
  ALIPAY = 'alipay',
  BANK_TRANSFER = 'bank_transfer',
}

export enum PaymentMethod {
  QRCODE = 'qrcode',
  JSAPI = 'jsapi',
  H5 = 'h5',
  NATIVE = 'native',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum InvoiceType {
  PERSONAL = 'personal',
  ENTERPRISE = 'enterprise',
}

export enum InvoiceStatus {
  PENDING = 'pending',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

export enum TransferStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

export enum MerchantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum NotifyStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export const RETRY_DELAYS = [
  15 * 1000,       // 15s
  30 * 1000,       // 30s
  60 * 1000,       // 1min
  5 * 60 * 1000,   // 5min
  15 * 60 * 1000,  // 15min
  30 * 60 * 1000,  // 30min
  60 * 60 * 1000,  // 1h
  2 * 60 * 60 * 1000,  // 2h
  6 * 60 * 60 * 1000,  // 6h
  24 * 60 * 60 * 1000, // 24h
];

export const MAX_RETRY_ATTEMPTS = 10;
export const ORDER_DEFAULT_EXPIRE_MINUTES = 30;
export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
export const NONCE_TTL_SECONDS = 600; // 10 minutes
