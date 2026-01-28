import { v4 as uuidv4 } from 'uuid';

export class IdGenerator {
  static generateOrderId(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = uuidv4().replace(/-/g, '').substring(0, 12);
    return `ord_${date}_${rand}`;
  }

  static generatePaymentId(): string {
    const rand = uuidv4().replace(/-/g, '').substring(0, 16);
    return `pay_${rand}`;
  }

  static generateRefundId(): string {
    const rand = uuidv4().replace(/-/g, '').substring(0, 16);
    return `ref_${rand}`;
  }

  static generateMerchantId(): string {
    const rand = uuidv4().replace(/-/g, '').substring(0, 12);
    return `mch_${rand}`;
  }

  static generateInvoiceId(): string {
    const rand = uuidv4().replace(/-/g, '').substring(0, 12);
    return `inv_${rand}`;
  }

  static generateTransferId(): string {
    const rand = uuidv4().replace(/-/g, '').substring(0, 12);
    return `tfr_${rand}`;
  }

  static generateAppKey(): string {
    return `ak_${uuidv4().replace(/-/g, '')}`;
  }

  static generateAppSecret(): string {
    return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  }

  static generateTraceId(): string {
    return `trace_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  }

  static generateNonce(): string {
    return uuidv4().replace(/-/g, '');
  }
}
