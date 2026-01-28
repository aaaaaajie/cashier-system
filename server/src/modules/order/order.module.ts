import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Order, OrderSchema } from './order.schema';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { MerchantModule } from '../merchant/merchant.module';
import { OrderScheduler } from './order.scheduler';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]), MerchantModule],
  controllers: [OrderController],
  providers: [OrderService, OrderScheduler, ApiSignGuard],
  exports: [OrderService, MongooseModule],
})
export class OrderModule {}
