import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, index: true })
  merchantId: string;

  @Prop({ required: true })
  productId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  unitPrice: number;

  @Prop({ default: 'CNY' })
  currency: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ merchantId: 1, productId: 1 }, { unique: true });
ProductSchema.index({ merchantId: 1, updatedAt: -1 });
