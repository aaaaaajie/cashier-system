import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Order, OrderDocument } from '../order/order.schema';
import { QueryPaysetDto } from './dto/query-payset.dto';
import { FieldDef, PaysetResult } from '../../common/interfaces';

@Injectable()
export class RecordService {
  constructor(@InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>) {}

  private buildFieldset(): FieldDef[] {
    return [
      { field: 'orderId', label: '订单号', type: 'string' },
      { field: 'externalOrderId', label: '外部订单号', type: 'string' },
      { field: 'subject', label: '商品名称', type: 'string' },
      { field: 'amount', label: '金额(分)', type: 'number' },
      { field: 'status', label: '状态', type: 'string' },
      { field: 'paymentChannel', label: '支付渠道', type: 'string' },
      { field: 'paidAt', label: '支付时间', type: 'date' },
    ];
  }

  async queryPayset(merchantId: string, query: QueryPaysetDto): Promise<PaysetResult> {
    const filter: any = { merchantId };
    if (query.status) filter.status = query.status;
    if (query.paymentChannel) filter.paymentChannel = query.paymentChannel;

    if (query.startDate || query.endDate) {
      filter.paidAt = {};
      if (query.startDate) filter.paidAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.paidAt.$lte = new Date(query.endDate);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const sort: any = {};
    if (query.sortField) {
      sort[query.sortField] = query.sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    const [total, orders] = await Promise.all([
      this.orderModel.countDocuments(filter),
      this.orderModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const dataset = orders.map((o) => ({
      orderId: o.orderId,
      externalOrderId: o.externalOrderId,
      subject: o.subject,
      amount: o.amount,
      status: o.status,
      paymentChannel: o.paymentChannel || null,
      paidAt: o.paidAt || null,
    }));

    return { total, fieldset: this.buildFieldset(), dataset };
  }

  async exportPaysetCsv(merchantId: string, query: QueryPaysetDto): Promise<string> {
    // Export the first 10k rows max for safety
    const q = { ...query, page: 1, pageSize: 10000 };
    const result = await this.queryPayset(merchantId, q);

    const header = result.fieldset.map((f) => f.label).join(',');
    const lines = result.dataset.map((row) => {
      const values = result.fieldset.map((f) => {
        const v = (row as any)[f.field];
        const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? '' : String(v);
        // naive CSV escaping
        const escaped = s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/\"/g, '""')}"` : s;
        return escaped;
      });
      return values.join(',');
    });

    return [header, ...lines].join('\n');
  }
}
