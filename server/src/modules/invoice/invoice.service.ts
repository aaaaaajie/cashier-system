import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Invoice, InvoiceDocument } from './invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ErrorCode, InvoiceStatus, OrderStatus } from '../../common/constants';
import { IdGenerator } from '../../common/utils/id-generator.util';
import { Order, OrderDocument } from '../order/order.schema';
import { QueryInvoiceAdminDto } from './dto/query-invoice-admin.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async createInvoice(merchantId: string, dto: CreateInvoiceDto) {
    const order = await this.orderModel.findOne({ merchantId, orderId: dto.orderId }).lean();
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    if (order.status !== OrderStatus.PAID) {
      throw new HttpException({ code: ErrorCode.ORDER_STATUS_INVALID, message: '订单未支付，无法开票' }, HttpStatus.BAD_REQUEST);
    }

    const invoiceId = IdGenerator.generateInvoiceId();
    const created = await this.invoiceModel.create({
      invoiceId,
      orderId: dto.orderId,
      merchantId,
      type: dto.type,
      title: dto.title,
      taxNumber: dto.taxNumber,
      address: dto.address,
      phone: dto.phone,
      bankName: dto.bankName,
      bankAccount: dto.bankAccount,
      amount: order.amount,
      status: InvoiceStatus.PENDING,
    });

    this.logger.log(JSON.stringify({ action: 'invoice.created', merchantId, invoiceId, orderId: dto.orderId }));
    return { invoiceId: created.invoiceId, status: created.status };
  }

  async getInvoice(merchantId: string, invoiceId: string) {
    const invoice = await this.invoiceModel.findOne({ merchantId, invoiceId }).lean();
    if (!invoice) {
      throw new HttpException({ code: ErrorCode.INVOICE_NOT_FOUND, message: '发票申请不存在' }, HttpStatus.NOT_FOUND);
    }
    return invoice;
  }

  async getInvoiceAdmin(invoiceId: string) {
    const invoice = await this.invoiceModel.findOne({ invoiceId }).lean();
    if (!invoice) {
      throw new HttpException({ code: ErrorCode.INVOICE_NOT_FOUND, message: '发票申请不存在' }, HttpStatus.NOT_FOUND);
    }
    return invoice;
  }

  async listAdmin(query: QueryInvoiceAdminDto) {
    const filter: any = {};
    if (query.merchantId) filter.merchantId = query.merchantId;
    if (query.orderId) filter.orderId = query.orderId;
    if (query.status) filter.status = query.status;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, data] = await Promise.all([
      this.invoiceModel.countDocuments(filter),
      this.invoiceModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return { total, page, pageSize, data };
  }

  async issueInvoice(invoiceId: string, operatorId?: string) {
    const invoice = await this.invoiceModel.findOne({ invoiceId });
    if (!invoice) {
      throw new HttpException({ code: ErrorCode.INVOICE_NOT_FOUND, message: '发票申请不存在' }, HttpStatus.NOT_FOUND);
    }
    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new HttpException(
        { code: ErrorCode.INVOICE_STATUS_INVALID, message: '发票状态不允许确认开票' },
        HttpStatus.BAD_REQUEST,
      );
    }
    invoice.status = InvoiceStatus.ISSUED;
    invoice.issuedAt = new Date();
    if (operatorId) invoice.operatorId = operatorId;
    await invoice.save();

    this.logger.log(JSON.stringify({ action: 'invoice.issued', invoiceId, operatorId }));
    return { invoiceId, status: invoice.status };
  }
}
