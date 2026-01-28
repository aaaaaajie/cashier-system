import { http } from './http';

export interface CashierOrder {
  orderId: string;
  externalOrderId?: string;
  subject: string;
  amount: number;
  currency: string;
  status: string;
  expireAt: string;
  paidAt?: string | null;
  paymentChannel?: string | null;
  paymentMethod?: string | null;
  channelOrderId?: string | null;
  returnUrl?: string | null;
  metadata?: Record<string, any> | null;
}

export function getCashierOrder(orderId: string, token: string) {
  return http.get<CashierOrder>(`/api/v1/cashier/orders/${orderId}`, {
    params: { t: token },
  });
}

export function createCashierPayment(payload: {
  orderId: string;
  token: string;
  channel?: 'wechat' | 'alipay';
  openId?: string;
}) {
  return http.post('/api/v1/cashier/pay', payload);
}

export function prepareExternalPayment(payload: { merchantId: string; externalOrderId: string }) {
  return http.post('/api/v1/cashier/external/prepare', payload);
}

export function mockChannelPaid(payload: {
  orderId: string;
  channelOrderId: string;
  amount: number;
}) {
  return http.post('/api/v1/callbacks/alipay', {
    orderId: payload.orderId,
    channelOrderId: payload.channelOrderId,
    amount: payload.amount,
    success: true,
  });
}
