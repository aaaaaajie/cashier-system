import { Body, Controller, Post, UseGuards, UsePipes, Req } from '@nestjs/common';
import { Request } from 'express';

import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { ExternalOrderService } from './external-order.service';
import { PreparePaymentDto } from './dto/prepare-payment.dto';

@Controller('/api/v1/external')
@UseGuards(ApiSignGuard)
export class ExternalOrderController {
  constructor(private readonly externalOrderService: ExternalOrderService) {}

  @Post('prepare-payment')
  @UsePipes(new CustomValidationPipe())
  async preparePayment(@CurrentMerchant('merchantId') merchantId: string, @Body() dto: PreparePaymentDto) {
    return this.externalOrderService.prepareExternalPayment(merchantId, dto.orderId);
  }

  @Post('pay')
  @UsePipes(new CustomValidationPipe())
  async pay(@Body() dto: PreparePaymentDto, @Req() req: Request) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = (req.headers['user-agent'] as string) || '';
    return this.externalOrderService.createCashierPayment(dto.orderId, dto.channelHint, ua, clientIp);
  }
}
