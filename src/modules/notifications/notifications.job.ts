import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { NOTIFICATIONS_QUEUE } from './notifications.queue';
import { NotificationsService } from './notifications.service';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsJob {
  private readonly logger = new Logger(NotificationsJob.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Process('tick')
  async handleTick(): Promise<void> {
    const due = await this.notificationsService.getUsersForNotificationTick(
      new Date(),
    );
    for (const row of due) {
      try {
        await this.notificationsService.sendFcm(
          row.fcmToken,
          'Your TechDaily lesson is ready',
          'Open app and continue your streak',
        );
      } catch (e) {
        this.logger.warn(
          `FCM send failed for user ${row.userId}: ${(e as Error).message}`,
        );
      }
    }
  }
}
