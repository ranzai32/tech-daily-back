import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AiPipelineService } from './ai-pipeline.service';
import { CurationJob } from './curation.job';
import { GeminiService } from './gemini.service';
import { CURATION_QUEUE, REVIEW_QUEUE } from './review.queue';

@Module({
  imports: [
    BullModule.registerQueue({ name: CURATION_QUEUE }, { name: REVIEW_QUEUE }),
  ],
  providers: [AiPipelineService, CurationJob, GeminiService],
  exports: [AiPipelineService, GeminiService],
})
export class AiPipelineModule {}
