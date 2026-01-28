import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';

import { Refund, RefundDocument } from './refund.schema';
import { CreateRefundDto, QueryRefundDto } from './dto/create-refund.dto';
import { ErrorCode, OrderStatus, PaymentStatus, RefundStatus } from '../../common/constants';
import { IdGenerator } from '../../common/utils/id-generator.util';
import { Order, OrderDocument } from '../order/order.schema';
import { Payment, PaymentDocument } from '../payment/payment.schema';
import { Merchant, MerchantDocument } from '../merchant/merchant.schema';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { ChannelFactory } from '../payment/channels/channel.factory';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectModel(Refund.name) private readonly refundModel: Model<RefundDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Merchant.name) private readonly merchantModel: Model<MerchantDocument>,
    private readonly configService: ConfigService,
    private readonly channelFactory: ChannelFactory,
  ) {}

  private decryptMerchantConfig(merchant: any) {
    const masterKey = this.configService.get<string>('masterEncryptionKey')!;
    const cfg = merchant.paymentConfig || {};
    const wechat = cfg.wechat
      ? {
          ...cfg.wechat,
          apiKeyV3: cfg.wechat.apiKeyV3 ? CryptoUtil.decrypt(cfg.wechat.apiKeyV3, masterKey) : undefined,
          privateKey: cfg.wechat.privateKey ? CryptoUtil.decrypt(cfg.wechat.privateKey, masterKey) : undefined,
        }
      : undefined;
    const alipay = cfg.alipay
      ? {
          ...cfg.alipay,
          privateKey: cfg.alipay.privateKey ? CryptoUtil.decrypt(cfg.alipay.privateKey, masterKey) : undefined,
        }
      : undefined;
    return { ...cfg, wechat, alipay };
  }

  async createRefund(merchantId: string, dto: CreateRefundDto) {
    const order = await this.orderModel.findOne({ merchantId, orderId: dto.orderId }).lean();
    if (!order) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '订单不存在' }, HttpStatus.NOT_FOUND);
    }
    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.REFUNDING && order.status !== OrderStatus.REFUNDED) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_PAID, message: '订单未支付，无法退款' }, HttpStatus.BAD_REQUEST);
    }

    const refundableAgg = await this.refundModel.aggregate([
      { $match: { merchantId, orderId: dto.orderId, status: { $in: [RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.SUCCESS] } } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);
    const refunded = refundableAgg[0]?.sum ?? 0;
    if (refunded + dto.amount > order.amount) {
      throw new HttpException(
        { code: ErrorCode.REFUND_AMOUNT_EXCEEDED, message: '退款金额超过可退金额' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const payment = await this.paymentModel
      .findOne({ merchantId, orderId: dto.orderId, status: PaymentStatus.SUCCESS })
      .sort({ createdAt: -1 })
      .lean();
    if (!payment || !payment.channelTransactionId) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_PAID, message: '未找到成功支付流水' }, HttpStatus.BAD_REQUEST);
    }

    const merchant = await this.merchantModel.findOne({ merchantId }).lean();
    if (!merchant) {
      throw new HttpException({ code: ErrorCode.MERCHANT_NOT_FOUND, message: '商户不存在' }, HttpStatus.NOT_FOUND);
    }

    const refundId = IdGenerator.generateRefundId();
    await this.orderModel.updateOne({ merchantId, orderId: dto.orderId }, { $set: { status: OrderStatus.REFUNDING } });
    await this.refundModel.create({
      refundId,
      orderId: dto.orderId,
      paymentId: payment.paymentId,
      merchantId,
      amount: dto.amount,
      reason: dto.reason,
      status: RefundStatus.PROCESSING,
    });

    const paymentConfig = this.decryptMerchantConfig(merchant);
    const channelImpl = this.channelFactory.getChannel(payment.channel);
    const result = await channelImpl.refund(
      {
        refundId,
        channelOrderId: payment.channelTransactionId,
        totalAmount: order.amount,
        refundAmount: dto.amount,
        reason: dto.reason,
      },
      paymentConfig[payment.channel],
    );

    if (!result.success) {
      await this.refundModel.updateOne(
        { refundId, merchantId },
        { $set: { status: RefundStatus.FAILED } },
      );
      throw new HttpException(
        { code: ErrorCode.REFUND_CHANNEL_FAILED, message: result.errorMessage || '退款渠道调用失败' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    await this.refundModel.updateOne(
      { refundId, merchantId },
      { $set: { status: RefundStatus.SUCCESS, channelRefundId: result.channelRefundId } },
    );

    const afterAgg = await this.refundModel.aggregate([
      { $match: { merchantId, orderId: dto.orderId, status: RefundStatus.SUCCESS } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);
    const totalRefunded = afterAgg[0]?.sum ?? 0;
    if (totalRefunded >= order.amount) {
      await this.orderModel.updateOne({ merchantId, orderId: dto.orderId }, { $set: { status: OrderStatus.REFUNDED } });
    } else {
      await this.orderModel.updateOne({ merchantId, orderId: dto.orderId }, { $set: { status: OrderStatus.PAID } });
    }

    this.logger.log(JSON.stringify({ action: 'refund.created', merchantId, orderId: dto.orderId, refundId }));
    return { refundId, status: RefundStatus.SUCCESS };
  }

  async getRefund(merchantId: string, refundId: string) {
    const refund = await this.refundModel.findOne({ merchantId, refundId }).lean();
    if (!refund) {
      throw new HttpException({ code: ErrorCode.ORDER_NOT_FOUND, message: '退款单不存在' }, HttpStatus.NOT_FOUND);
    }
    return refund;
  }

  async listRefunds(merchantId: string, query: QueryRefundDto) {
    const filter: any = { merchantId };
    if (query.orderId) filter.orderId = query.orderId;
    if (query.status) filter.status = query.status;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [total, data] = await Promise.all([
      this.refundModel.countDocuments(filter),
      this.refundModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    return { total, page, pageSize, data };
  }
}
