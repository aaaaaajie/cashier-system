import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { RecordController } from './record.controller';
import { RecordService } from './record.service';
import { MerchantModule } from '../merchant/merchant.module';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';

@Module({
  imports: [OrderModule, MerchantModule],
  controllers: [RecordController],
  providers: [RecordService, ApiSignGuard],
})
export class RecordModule {}
