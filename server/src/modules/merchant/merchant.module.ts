import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Merchant, MerchantSchema } from './merchant.schema';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: Merchant.name, schema: MerchantSchema }]), AuthModule],
  controllers: [MerchantController],
  providers: [MerchantService, JwtAuthGuard],
  exports: [MerchantService, MongooseModule],
})
export class MerchantModule {}
