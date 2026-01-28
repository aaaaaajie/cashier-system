import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { NotificationLog, NotificationLogSchema } from './notification-log.schema';
import { NotificationService } from './notification.service';
import { NotificationScheduler } from './notification.scheduler';
import { OrderModule } from '../order/order.module';
import { MerchantModule } from '../merchant/merchant.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NotificationLog.name, schema: NotificationLogSchema }]),
    OrderModule,
    MerchantModule,
  ],
  providers: [NotificationService, NotificationScheduler],
  exports: [NotificationService],
})
export class NotificationModule {}

