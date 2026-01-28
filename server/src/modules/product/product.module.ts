import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from './product.schema';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { MerchantModule } from '../merchant/merchant.module';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]), MerchantModule],
  controllers: [ProductController],
  providers: [ProductService, ApiSignGuard],
  exports: [ProductService, MongooseModule],
})
export class ProductModule {}
