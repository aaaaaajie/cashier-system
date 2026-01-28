import { Body, Controller, Get, Param, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { CreateRefundDto, QueryRefundDto } from './dto/create-refund.dto';
import { RefundService } from './refund.service';

@Controller('/api/v1/refunds')
@UseGuards(ApiSignGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  @UsePipes(new CustomValidationPipe())
  async create(@CurrentMerchant('merchantId') merchantId: string, @Body() dto: CreateRefundDto) {
    return this.refundService.createRefund(merchantId, dto);
  }

  @Get(':refundId')
  async get(@CurrentMerchant('merchantId') merchantId: string, @Param('refundId') refundId: string) {
    return this.refundService.getRefund(merchantId, refundId);
  }

  @Get()
  @UsePipes(new CustomValidationPipe())
  async list(@CurrentMerchant('merchantId') merchantId: string, @Query() query: QueryRefundDto) {
    return this.refundService.listRefunds(merchantId, query);
  }
}

