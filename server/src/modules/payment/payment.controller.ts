import { Body, Controller, Get, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';

import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { PaymentService } from './payment.service';
import { CreateH5PaymentDto, CreateJsapiPaymentDto, CreateQrcodeDto } from './dto/create-payment.dto';

@Controller('/api/v1/payments')
@UseGuards(ApiSignGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('qrcode')
  @UsePipes(new CustomValidationPipe())
  async qrcode(@CurrentMerchant('merchantId') merchantId: string, @Body() dto: CreateQrcodeDto) {
    return this.paymentService.getUnifiedQrcode(merchantId, dto.orderId);
  }

  @Post('jsapi')
  @UsePipes(new CustomValidationPipe())
  async jsapi(
    @CurrentMerchant('merchantId') merchantId: string,
    @Body() dto: CreateJsapiPaymentDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    return this.paymentService.createJsapiPayment(merchantId, dto.orderId, dto.openId, clientIp);
  }

  @Post('h5')
  @UsePipes(new CustomValidationPipe())
  async h5(
    @CurrentMerchant('merchantId') merchantId: string,
    @Body() dto: CreateH5PaymentDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = (req.headers['user-agent'] as string) || '';
    const headerChannel = (req.headers['x-payment-channel'] as string) || '';
    return this.paymentService.createH5Payment(merchantId, dto.orderId, { ua, channelHint: headerChannel }, clientIp);
  }

  @Get(':paymentId')
  async getById(@CurrentMerchant('merchantId') merchantId: string, @Param('paymentId') paymentId: string) {
    return this.paymentService.getPaymentDetail(merchantId, paymentId);
  }
}
