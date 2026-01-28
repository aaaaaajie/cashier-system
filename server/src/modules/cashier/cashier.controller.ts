import { Body, Controller, Get, Param, Post, Query, Req, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CashierService } from './cashier.service';
import { CashierPayDto } from './dto/cashier-pay.dto';
import { CashierExternalPrepareDto } from './dto/cashier-external-prepare.dto';
import { ExternalOrderService } from '../external-order/external-order.service';

@Controller('/api/v1/cashier')
export class CashierController {
  constructor(
    private readonly cashierService: CashierService,
    private readonly externalOrderService: ExternalOrderService,
  ) {}

  @Get('orders/:orderId')
  async getOrder(@Param('orderId') orderId: string, @Query('t') token: string) {
    return this.cashierService.getOrderForCashier(orderId, token);
  }

  @Post('pay')
  @UsePipes(new CustomValidationPipe())
  async pay(@Body() dto: CashierPayDto, @Req() req: Request) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = (req.headers['user-agent'] as string) || '';
    return this.cashierService.createPayment(dto, { clientIp, ua });
  }

  @Post('external/prepare')
  @UsePipes(new CustomValidationPipe())
  async externalPrepare(@Body() dto: CashierExternalPrepareDto) {
    return this.externalOrderService.prepareExternalPayment(dto.merchantId, dto.externalOrderId);
  }
}
