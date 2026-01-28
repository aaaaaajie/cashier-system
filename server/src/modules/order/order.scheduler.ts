import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderService } from './order.service';

@Injectable()
export class OrderScheduler {
  private readonly logger = new Logger(OrderScheduler.name);

  constructor(private readonly orderService: OrderService) {}

  @Cron('*/60 * * * * *')
  async expireOrders() {
    const count = await this.orderService.expireDueOrders();
    if (count > 0) {
      this.logger.log(JSON.stringify({ action: 'order.expired', count }));
    }
  }
}

