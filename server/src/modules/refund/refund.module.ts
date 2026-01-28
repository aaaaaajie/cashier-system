import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';
import { Refund, RefundSchema } from './refund.schema';
import { OrderModule } from '../order/order.module';
import { MerchantModule } from '../merchant/merchant.module';
import { PaymentModule } from '../payment/payment.module';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Refund.name, schema: RefundSchema }]),
    OrderModule,
    PaymentModule,
    MerchantModule,
  ],
  controllers: [RefundController],
  providers: [RefundService, ApiSignGuard],
})
export class RefundModule {}
