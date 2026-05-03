import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { DAILY_CURATION_QUEUE } from './review.queue';
import { TopicsService } from '../topics/topics.service';
import { AiPipelineService } from './ai-pipeline.service';

@Processor(DAILY_CURATION_QUEUE)
export class DailyCurationJob {
  private readonly logger = new Logger(DailyCurationJob.name);

  constructor(
    private readonly topicsService: TopicsService,
    private readonly aiPipeline: AiPipelineService,
    @InjectQueue(DAILY_CURATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  @Process('tick')
  async handleTick(): Promise<void> {
    const userIds = await this.topicsService.getUserIdsWithTopics();
    for (let i = 0; i < userIds.length; i += 50) {
      const chunk = userIds.slice(i, i + 50);
      await this.queue.add('batch', { userIds: chunk });
    }
  }

  @Process('batch')
  async handleBatch(job: Job<{ userIds: string[] }>): Promise<void> {
    for (const userId of job.data.userIds) {
      try {
        await this.aiPipeline.curateDailyContent(userId);
      } catch (e) {
        this.logger.warn(
          `Daily curation failed for user ${userId}: ${(e as Error).message}`,
        );
      }
    }
  }
}
