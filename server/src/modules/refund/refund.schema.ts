import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RefundStatus } from '../../common/constants';

export type RefundDocument = Refund & Document;

@Schema({ timestamps: true, collection: 'refunds' })
export class Refund {
  @Prop({ required: true, unique: true, index: true })
  refundId: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  paymentId: string;

  @Prop({ required: true })
  merchantId: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  reason?: string;

  @Prop({
    type: String,
    enum: Object.values(RefundStatus),
    default: RefundStatus.PENDING,
  })
  status: RefundStatus;

  @Prop()
  channelRefundId?: string;

  @Prop()
  operatorId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
