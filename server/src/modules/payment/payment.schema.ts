import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { PaymentChannel, PaymentStatus } from '../../common/constants';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ required: true, unique: true, index: true })
  paymentId: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  merchantId: string;

  @Prop({ type: String, enum: Object.values(PaymentChannel), required: true })
  channel: PaymentChannel;

  @Prop()
  method: string;

  @Prop({ required: true })
  amount: number;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Prop({ type: MongooseSchema.Types.Mixed })
  channelResponse?: Record<string, any>;

  @Prop()
  channelTransactionId?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  failReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ channelTransactionId: 1 });
