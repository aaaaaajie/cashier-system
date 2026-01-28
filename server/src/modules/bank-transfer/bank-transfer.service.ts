import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BankTransfer, BankTransferDocument } from './bank-transfer.schema';
import { CreateBankTransferDto, ReviewTransferDto } from './dto/create-bank-transfer.dto';
import { QueryBankTransferAdminDto } from './dto/query-bank-transfer-admin.dto';
import {
  ErrorCode,
  OrderStatus,
  PaymentChannel,
  TransferStatus,
} from '../../common/constants';
import { IdGenerator } from '../../common/utils/id-generator.util';
import { Order, OrderDocument } from '../order/order.schema';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    @InjectModel(BankTransfer.name) private readonly transferModel: Model<BankTransferDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async createTransfer(merchantId: string, dto: CreateBankTransferDto) {
    const order = await this.orderModel.findOne({ merchantId, orderId: dto.orderId }).lean();
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    if ([OrderStatus.PAID, OrderStatus.REFUNDED].includes(order.status)) {
      throw new HttpException({ code: ErrorCode.ORDER_STATUS_INVALID, message: '订单已完成，无法创建打款申请' }, HttpStatus.BAD_REQUEST);
    }

    const transferId = IdGenerator.generateTransferId();
    await this.transferModel.create({
      transferId,
      orderId: dto.orderId,
      merchantId,
      bankInfo: dto.bankInfo,
      amount: order.amount,
      status: TransferStatus.PENDING,
    });

    await this.orderModel.updateOne(
      { merchantId, orderId: dto.orderId },
      { $set: { paymentChannel: PaymentChannel.BANK_TRANSFER } },
    );

    this.logger.log(JSON.stringify({ action: 'bank_transfer.created', merchantId, orderId: dto.orderId, transferId }));
    return { transferId, status: TransferStatus.PENDING };
  }

  async uploadProof(merchantId: string, transferId: string, proofUrl: string) {
    const transfer = await this.transferModel.findOne({ merchantId, transferId });
    if (!transfer) {
      throw new HttpException({ code: ErrorCode.TRANSFER_NOT_FOUND, message: '打款申请不存在' }, HttpStatus.NOT_FOUND);
    }
    if (![TransferStatus.PENDING, TransferStatus.REJECTED].includes(transfer.status)) {
      throw new HttpException(
        { code: ErrorCode.TRANSFER_STATUS_INVALID, message: '当前状态不允许上传凭证' },
        HttpStatus.BAD_REQUEST,
      );
    }
    transfer.proofUrl = proofUrl;
    transfer.status = TransferStatus.UPLOADED;
    await transfer.save();

    this.logger.log(JSON.stringify({ action: 'bank_transfer.proof_uploaded', merchantId, transferId }));
    return { transferId, status: transfer.status };
  }

  async getAdmin(transferId: string) {
    const transfer = await this.transferModel.findOne({ transferId }).lean();
    if (!transfer) {
      throw new HttpException({ code: ErrorCode.TRANSFER_NOT_FOUND, message: '打款申请不存在' }, HttpStatus.NOT_FOUND);
    }
    return transfer;
  }

  async listAdmin(query: QueryBankTransferAdminDto) {
    const filter: any = {};
    if (query.merchantId) filter.merchantId = query.merchantId;
    if (query.orderId) filter.orderId = query.orderId;
    if (query.status) filter.status = query.status;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, data] = await Promise.all([
      this.transferModel.countDocuments(filter),
      this.transferModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return { total, page, pageSize, data };
  }

  async reviewTransfer(transferId: string, dto: ReviewTransferDto) {
    const transfer = await this.transferModel.findOne({ transferId });
    if (!transfer) {
      throw new HttpException({ code: ErrorCode.TRANSFER_NOT_FOUND, message: '打款申请不存在' }, HttpStatus.NOT_FOUND);
    }
    if (![TransferStatus.UPLOADED].includes(transfer.status)) {
      throw new HttpException(
        { code: ErrorCode.TRANSFER_STATUS_INVALID, message: '当前状态不允许审核' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.action === 'confirm') {
      transfer.status = TransferStatus.CONFIRMED;
      transfer.reviewedAt = new Date();
      transfer.reviewerId = dto.reviewerId;
      transfer.reviewNote = dto.reviewNote;
      await transfer.save();

      await this.orderModel.updateOne(
        { merchantId: transfer.merchantId, orderId: transfer.orderId },
        { $set: { status: OrderStatus.PAID, paidAt: new Date(), paymentChannel: PaymentChannel.BANK_TRANSFER } },
      );

      this.logger.log(JSON.stringify({ action: 'bank_transfer.confirmed', transferId }));
      await this.notificationService.enqueuePaymentNotify(transfer.orderId);
      return { transferId, status: transfer.status };
    }

    transfer.status = TransferStatus.REJECTED;
    transfer.reviewedAt = new Date();
    transfer.reviewerId = dto.reviewerId;
    transfer.reviewNote = dto.reviewNote;
    await transfer.save();

    this.logger.log(JSON.stringify({ action: 'bank_transfer.rejected', transferId }));
    return { transferId, status: transfer.status };
  }
}
