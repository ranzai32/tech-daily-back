import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GeminiService, CuratedLesson, GeneratedFlashcard } from './gemini.service';
import { CURATION_QUEUE } from './review.queue';
import { CurationPayload } from './curation.job';

@Injectable()
export class AiPipelineService {
  constructor(
    @InjectQueue(CURATION_QUEUE)
    private readonly curationQueue: Queue<CurationPayload>,
    private readonly geminiService: GeminiService,
  ) {}

  async addCurationJob(
    url: string,
    topicId: string,
    topicName: string,
  ): Promise<void> {
    await this.curationQueue.add({ url, topicId, topicName });
  }

  async curateText(
    text: string,
    topicName: string,
  ): Promise<CuratedLesson> {
    return this.geminiService.curateFromText(text, topicName);
  }

  async generateFlashcards(
    lessonContent: string,
    count = 5,
  ): Promise<GeneratedFlashcard[]> {
    return this.geminiService.generateFlashcards(lessonContent, count);
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
  }> {
    const [waiting, active, completed] = await Promise.all([
      this.curationQueue.getWaitingCount(),
      this.curationQueue.getActiveCount(),
      this.curationQueue.getCompletedCount(),
    ]);
    return { waiting, active, completed };
  }
}
