import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Invoice, InvoiceSchema } from './invoice.schema';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { OrderModule } from '../order/order.module';
import { AuthModule } from '../auth/auth.module';
import { MerchantModule } from '../merchant/merchant.module';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
    OrderModule,
    MerchantModule,
    AuthModule,
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, ApiSignGuard, JwtAuthGuard],
})
export class InvoiceModule {}
