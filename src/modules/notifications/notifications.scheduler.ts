import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NOTIFICATIONS_QUEUE } from './notifications.queue';

@Injectable()
export class NotificationsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const repeatables = await this.queue.getRepeatableJobs();
    for (const r of repeatables) {
      if (r.id === 'notifications-tick' || r.name === 'tick') {
        await this.queue.removeRepeatableByKey(r.key);
      }
    }
    await this.queue.add(
      'tick',
      {},
      {
        jobId: 'notifications-tick',
        repeat: { cron: '* * * * *', tz: 'Etc/UTC' },
      },
    );
    this.logger.log('Notifications tick registered: every minute UTC');
  }
}
