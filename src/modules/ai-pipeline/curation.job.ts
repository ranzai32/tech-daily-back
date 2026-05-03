import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { GeminiService, CuratedLesson } from './gemini.service';
import { CURATION_QUEUE, REVIEW_QUEUE } from './review.queue';

export interface CurationPayload {
  url: string;
  topicId: string;
  topicName: string;
}

export interface ReviewPayload {
  topicId: string;
  lesson: CuratedLesson;
  sourceUrl: string;
}

@Processor(CURATION_QUEUE)
export class CurationJob {
  private readonly logger = new Logger(CurationJob.name);

  constructor(
    private readonly geminiService: GeminiService,
    @InjectQueue(REVIEW_QUEUE)
    private readonly reviewQueue: Queue<ReviewPayload>,
  ) {}

  @Process()
  async process(job: Job<CurationPayload>): Promise<void> {
    const { url, topicId, topicName } = job.data;
    this.logger.log(`Processing curation job for: ${url}`);

    const lesson = await this.geminiService.curateFromUrl(url, topicName);

    await this.reviewQueue.add({
      topicId,
      lesson,
      sourceUrl: url,
    });

    this.logger.log(`Lesson curated: "${lesson.title}"`);
  }
}
