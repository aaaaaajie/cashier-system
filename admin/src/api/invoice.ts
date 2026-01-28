import { http } from './http';

export interface InvoiceItem {
  invoiceId: string;
  orderId: string;
  merchantId: string;
  type: string;
  title: string;
  amount: number;
  status: string;
  createdAt?: string;
  issuedAt?: string;
}

export interface InvoiceListResult {
  total: number;
  page: number;
  pageSize: number;
  data: InvoiceItem[];
}

export function listInvoices(params: { merchantId?: string; orderId?: string; status?: string; page?: number; pageSize?: number }) {
  return http.get<InvoiceListResult>('/api/v1/admin/invoices', { params });
}

export function issueInvoice(invoiceId: string, payload: { operatorId?: string }) {
  return http.put(`/api/v1/admin/invoices/${invoiceId}/issue`, payload);
}

