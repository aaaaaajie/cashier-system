import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { NotifyStatus } from '../../common/constants';

export type NotificationLogDocument = NotificationLog & Document;

@Schema({ timestamps: true, collection: 'notification_logs' })
export class NotificationLog {
  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ required: true })
  merchantId: string;

  @Prop({ required: true })
  url: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: Record<string, any>;

  @Prop()
  responseStatus?: number;

  @Prop()
  responseBody?: string;

  @Prop({ required: true, default: 1 })
  attempt: number;

  @Prop({
    type: String,
    enum: Object.values(NotifyStatus),
    default: NotifyStatus.PENDING,
  })
  status: NotifyStatus;

  @Prop()
  nextRetryAt?: Date;

  createdAt: Date;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);
NotificationLogSchema.index({ status: 1, nextRetryAt: 1 });
