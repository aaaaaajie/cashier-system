import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BankTransfer, BankTransferSchema } from './bank-transfer.schema';
import { BankTransferController } from './bank-transfer.controller';
import { BankTransferService } from './bank-transfer.service';
import { OrderModule } from '../order/order.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { MerchantModule } from '../merchant/merchant.module';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BankTransfer.name, schema: BankTransferSchema }]),
    OrderModule,
    MerchantModule,
    AuthModule,
    NotificationModule,
  ],
  controllers: [BankTransferController],
  providers: [BankTransferService, ApiSignGuard, JwtAuthGuard],
})
export class BankTransferModule {}
