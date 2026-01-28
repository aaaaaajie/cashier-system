import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { InvoiceType, InvoiceStatus } from '../../common/constants';

export type InvoiceDocument = Invoice & Document;

@Schema({ timestamps: true, collection: 'invoices' })
export class Invoice {
  @Prop({ required: true, unique: true, index: true })
  invoiceId: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  merchantId: string;

  @Prop({ type: String, enum: Object.values(InvoiceType), required: true })
  type: InvoiceType;

  @Prop({ required: true })
  title: string;

  @Prop()
  taxNumber?: string;

  @Prop()
  address?: string;

  @Prop()
  phone?: string;

  @Prop()
  bankName?: string;

  @Prop()
  bankAccount?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({
    type: String,
    enum: Object.values(InvoiceStatus),
    default: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @Prop()
  issuedAt?: Date;

  @Prop()
  operatorId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
InvoiceSchema.index({ merchantId: 1, status: 1 });
