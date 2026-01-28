import { http } from './http';

export interface BankTransferItem {
  transferId: string;
  orderId: string;
  merchantId: string;
  amount: number;
  status: string;
  proofUrl?: string;
  createdAt?: string;
  reviewedAt?: string;
}

export interface BankTransferListResult {
  total: number;
  page: number;
  pageSize: number;
  data: BankTransferItem[];
}

export function listBankTransfers(params: { merchantId?: string; orderId?: string; status?: string; page?: number; pageSize?: number }) {
  return http.get<BankTransferListResult>('/api/v1/admin/bank-transfers', { params });
}

export function reviewBankTransfer(
  transferId: string,
  payload: { action: 'confirm' | 'reject'; reviewNote?: string; reviewerId?: string },
) {
  return http.put(`/api/v1/admin/bank-transfers/${transferId}/review`, payload);
}

