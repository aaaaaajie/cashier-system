import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment, PaymentSchema } from './payment.schema';
import { ChannelFactory } from './channels/channel.factory';
import { WechatPayChannel } from './channels/wechat-pay.channel';
import { AlipayChannel } from './channels/alipay.channel';
import { CallbackController } from './callback.controller';
import { OrderModule } from '../order/order.module';
import { MerchantModule } from '../merchant/merchant.module';
import { NotificationModule } from '../notification/notification.module';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    OrderModule,
    MerchantModule,
    NotificationModule,
  ],
  controllers: [PaymentController, CallbackController],
  providers: [PaymentService, ChannelFactory, WechatPayChannel, AlipayChannel, ApiSignGuard],
  exports: [PaymentService, ChannelFactory, MongooseModule],
})
export class PaymentModule {}
