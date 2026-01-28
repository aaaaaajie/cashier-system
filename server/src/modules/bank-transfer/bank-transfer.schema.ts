import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TransferStatus } from '../../common/constants';

@Schema()
export class BankInfo {
  @Prop({ required: true }) bankName: string;
  @Prop({ required: true }) accountName: string;
  @Prop({ required: true }) accountNumber: string;
}

export type BankTransferDocument = BankTransfer & Document;

@Schema({ timestamps: true, collection: 'bank_transfers' })
export class BankTransfer {
  @Prop({ required: true, unique: true, index: true })
  transferId: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  merchantId: string;

  @Prop({ type: BankInfo, required: true })
  bankInfo: BankInfo;

  @Prop({ required: true })
  amount: number;

  @Prop({
    type: String,
    enum: Object.values(TransferStatus),
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Prop()
  proofUrl?: string;

  @Prop()
  reviewerId?: string;

  @Prop()
  reviewNote?: string;

  @Prop()
  reviewedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const BankTransferSchema = SchemaFactory.createForClass(BankTransfer);
BankTransferSchema.index({ merchantId: 1, status: 1 });
