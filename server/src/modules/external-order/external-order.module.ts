import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ExternalOrderController } from './external-order.controller';
import { ExternalOrderService } from './external-order.service';
import { Order, OrderSchema } from '../order/order.schema';
import { Merchant, MerchantSchema } from '../merchant/merchant.schema';
import { OrderModule } from '../order/order.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    OrderModule,
    PaymentModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Merchant.name, schema: MerchantSchema },
    ]),
  ],
  controllers: [ExternalOrderController],
  providers: [ExternalOrderService],
  exports: [ExternalOrderService],
})
export class ExternalOrderModule {}
