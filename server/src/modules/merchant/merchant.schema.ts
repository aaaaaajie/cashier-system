import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MerchantStatus } from '../../common/constants';

@Schema({ timestamps: true })
export class WechatConfig {
  @Prop() mchId: string;
  @Prop() appId: string;
  @Prop() apiKeyV3: string;   // AES-256 encrypted
  @Prop() certSerialNo: string;
  @Prop() privateKey: string;  // AES-256 encrypted
}

@Schema({ timestamps: true })
export class AlipayConfig {
  @Prop() appId: string;
  @Prop() privateKey: string;  // AES-256 encrypted
  @Prop() alipayPublicKey: string;
  @Prop({ default: 'RSA2' }) signType: string;
}

@Schema({ timestamps: true })
export class PaymentConfig {
  @Prop({ type: WechatConfig }) wechat?: WechatConfig;
  @Prop({ type: AlipayConfig }) alipay?: AlipayConfig;
}

export type MerchantDocument = Merchant & Document;

@Schema({ timestamps: true, collection: 'merchants' })
export class Merchant {
  @Prop({ required: true, unique: true, index: true })
  merchantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  appKey: string;

  @Prop({ required: true })
  appSecret: string;

  @Prop({ type: String, enum: Object.values(MerchantStatus), default: MerchantStatus.ACTIVE })
  status: MerchantStatus;

  @Prop({ type: PaymentConfig })
  paymentConfig?: PaymentConfig;

  @Prop()
  callbackUrl?: string;

  @Prop({ type: [String], default: [] })
  ipWhitelist: string[];

  @Prop({ type: Object })
  externalConfig?: {
    baseUrl: string;
    appKey?: string;
    appSecret?: string;
    sharedSecret: string;
    orderDetailPath?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);
