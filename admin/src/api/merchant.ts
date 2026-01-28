import { http } from './http';

export interface MerchantItem {
  merchantId: string;
  name: string;
  appKey: string;
  appSecret?: string;
  status: string;
  callbackUrl?: string;
  ipWhitelist: string[];
  paymentConfig?: {
    wechat?: {
      mchId?: string;
      appId?: string;
    };
    alipay?: {
      appId?: string;
    };
  };
  createdAt?: string;
}

export interface MerchantListResult {
  total: number;
  page: number;
  pageSize: number;
  data: MerchantItem[];
}

export function listMerchants(params: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  return http.get<MerchantListResult>('/api/v1/admin/merchants', { params });
}

export function createMerchant(payload: { name: string; callbackUrl?: string; ipWhitelist?: string[] }) {
  return http.post('/api/v1/admin/merchants', payload);
}

export function updateMerchant(merchantId: string, payload: { name?: string; callbackUrl?: string; ipWhitelist?: string[] }) {
  return http.put(`/api/v1/admin/merchants/${merchantId}`, payload);
}

export function configurePayment(
  merchantId: string,
  payload: {
    wechat?: {
      mchId: string;
      appId: string;
      apiKeyV3: string;
      certSerialNo: string;
      privateKey: string;
    };
    alipay?: {
      appId: string;
      privateKey: string;
      alipayPublicKey: string;
      signType?: string;
    };
  },
) {
  return http.post(`/api/v1/admin/merchants/${merchantId}/payment-config`, payload);
}
