import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Cron('*/10 * * * * *')
  async runDue() {
    const processed = await this.notificationService.processDueNotifications(50);
    if (processed > 0) {
      this.logger.log(JSON.stringify({ action: 'notify.batch_processed', processed }));
    }
  }
}

