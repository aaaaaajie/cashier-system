import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';

import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { ProductService } from './product.service';
import { UpsertProductDto } from './dto/upsert-product.dto';

@Controller('/api/v1/products')
@UseGuards(ApiSignGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post('upsert')
  @UsePipes(new CustomValidationPipe())
  async upsert(@CurrentMerchant('merchantId') merchantId: string, @Body() dto: UpsertProductDto) {
    return this.productService.upsert(merchantId, dto);
  }

  @Get(':productId')
  async get(@CurrentMerchant('merchantId') merchantId: string, @Param('productId') productId: string) {
    return this.productService.get(merchantId, productId);
  }

  @Get()
  async list(@CurrentMerchant('merchantId') merchantId: string) {
    return this.productService.list(merchantId);
  }
}
