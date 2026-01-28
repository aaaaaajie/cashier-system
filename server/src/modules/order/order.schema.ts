import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { OrderStatus, PaymentChannel, PaymentMethod } from '../../common/constants';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, unique: true, index: true })
  orderId: string;

  @Prop({ required: true, index: true })
  merchantId: string;

  @Prop({ required: true })
  externalOrderId: string;

  @Prop({ required: true })
  subject: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  amount: number; // 单位：分

  @Prop({ default: 'CNY' })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
    index: true,
  })
  status: OrderStatus;

  @Prop({ type: String, enum: Object.values(PaymentChannel) })
  paymentChannel?: PaymentChannel;

  @Prop({ type: String, enum: Object.values(PaymentMethod) })
  paymentMethod?: PaymentMethod;

  @Prop()
  channelOrderId?: string;

  @Prop()
  paidAt?: Date;

  @Prop({ required: true, index: true })
  expireAt: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;

  @Prop()
  userId?: string;

  @Prop()
  notifyUrl?: string;

  @Prop()
  returnUrl?: string;

  @Prop()
  clientIp?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ externalOrderId: 1, merchantId: 1 }, { unique: true });
OrderSchema.index({ merchantId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, expireAt: 1 });
