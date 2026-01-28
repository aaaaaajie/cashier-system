import { Module } from '@nestjs/common';
import { CashierController } from './cashier.controller';
import { CashierService } from './cashier.service';
import { OrderModule } from '../order/order.module';
import { PaymentModule } from '../payment/payment.module';
import { ExternalOrderModule } from '../external-order/external-order.module';

@Module({
  imports: [OrderModule, PaymentModule, ExternalOrderModule],
  controllers: [CashierController],
  providers: [CashierService],
})
export class CashierModule {}
