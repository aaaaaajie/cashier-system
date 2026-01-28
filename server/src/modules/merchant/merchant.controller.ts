import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { MerchantService } from './merchant.service';
import { ConfigurePaymentDto, CreateMerchantDto, UpdateMerchantDto } from './dto/create-merchant.dto';
import { ConfigureExternalDto } from './dto/external-config.dto';
import { QueryMerchantDto } from './dto/query-merchant.dto';

@Controller('/api/v1/admin/merchants')
@UseGuards(JwtAuthGuard)
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get()
  @UsePipes(new CustomValidationPipe())
  async list(@Query() query: QueryMerchantDto) {
    return this.merchantService.list(query);
  }

  @Post()
  @UsePipes(new CustomValidationPipe())
  async create(@Body() dto: CreateMerchantDto) {
    return this.merchantService.create(dto);
  }

  @Get(':merchantId')
  async get(@Param('merchantId') merchantId: string) {
    return this.merchantService.findById(merchantId);
  }

  @Put(':merchantId')
  @UsePipes(new CustomValidationPipe())
  async update(@Param('merchantId') merchantId: string, @Body() dto: UpdateMerchantDto) {
    return this.merchantService.update(merchantId, dto);
  }

  @Post(':merchantId/payment-config')
  @UsePipes(new CustomValidationPipe())
  async configurePayment(@Param('merchantId') merchantId: string, @Body() dto: ConfigurePaymentDto) {
    return this.merchantService.configurePayment(merchantId, dto);
  }

  @Post(':merchantId/external-config')
  @UsePipes(new CustomValidationPipe())
  async configureExternal(@Param('merchantId') merchantId: string, @Body() dto: ConfigureExternalDto) {
    return this.merchantService.configureExternal(merchantId, dto);
  }
}
