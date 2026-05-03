import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DAILY_CURATION_QUEUE } from './review.queue';

@Injectable()
export class DailyCurationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DailyCurationSchedulerService.name);

  constructor(
    @InjectQueue(DAILY_CURATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const repeatables = await this.queue.getRepeatableJobs();
    for (const r of repeatables) {
      if (r.id === 'daily-curation-tick' || r.name === 'tick') {
        await this.queue.removeRepeatableByKey(r.key);
      }
    }
    await this.queue.add(
      'tick',
      {},
      {
        jobId: 'daily-curation-tick',
        repeat: { cron: '0 8 * * *', tz: 'Etc/UTC' },
      },
    );
    this.logger.log('Daily curation cron registered: 08:00 UTC');
  }
}
