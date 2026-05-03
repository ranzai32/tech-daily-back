import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AiPipelineService } from './ai-pipeline.service';
import { GeminiService } from './gemini.service';
import { DAILY_CURATION_QUEUE } from './review.queue';
import { DailyCurationJob } from './daily-curation.job';
import { DailyCurationSchedulerService } from './daily-curation.scheduler';
import { AdminLessonsController } from './admin-lessons.controller';
import { AiPipelineController } from './ai-pipeline.controller';
import { TopicsModule } from '../topics/topics.module';
import { UsersModule } from '../users/users.module';
import { LessonsModule } from '../lessons/lessons.module';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [
    BullModule.registerQueue({ name: DAILY_CURATION_QUEUE }),
    TopicsModule,
    UsersModule,
    LessonsModule,
    AuthModule,
  ],
  providers: [
    AiPipelineService,
    GeminiService,
    DailyCurationJob,
    DailyCurationSchedulerService,
    AdminGuard,
  ],
  controllers: [AdminLessonsController, AiPipelineController],
  exports: [AiPipelineService, GeminiService],
})
export class AiPipelineModule {}
