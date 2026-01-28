import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Request } from 'express';

import { ApiSignGuard } from '../../common/guards/api-sign.guard';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { CurrentMerchant } from '../../common/decorators/merchant.decorator';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';

@Controller('/api/v1/orders')
@UseGuards(ApiSignGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UsePipes(new CustomValidationPipe())
  async create(
    @CurrentMerchant('merchantId') merchantId: string,
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    return this.orderService.createOrder(merchantId, dto, clientIp);
  }

  @Get(':orderId')
  async get(@CurrentMerchant('merchantId') merchantId: string, @Param('orderId') orderId: string) {
    return this.orderService.getOrder(merchantId, orderId);
  }

  @Post(':orderId/close')
  async close(@CurrentMerchant('merchantId') merchantId: string, @Param('orderId') orderId: string) {
    return this.orderService.closeOrder(merchantId, orderId);
  }

  @Get()
  @UsePipes(new CustomValidationPipe())
  async list(@CurrentMerchant('merchantId') merchantId: string, @Query() query: QueryOrderDto) {
    return this.orderService.listOrders(merchantId, query);
  }
}

