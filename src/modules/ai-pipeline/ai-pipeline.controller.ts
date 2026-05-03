import {
  Controller,
  Post,
  Get,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { AiPipelineService } from './ai-pipeline.service';

@Controller('ai-pipeline')
@UseGuards(JwtAuthGuard)
export class AiPipelineController {
  constructor(private readonly aiPipeline: AiPipelineService) {}

  @Get('status')
  async status() {
    const queue = await this.aiPipeline.getQueueStats();
    const key = (process.env.GEMINI_API_KEY ?? '').trim();
    return {
      gemini_configured: key.length > 8,
      model:
        (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim() ||
        'gemini-2.5-flash',
      auto_publish_after_curate:
        process.env.AI_AUTO_PUBLISH_CURATED_LESSONS === 'true',
      preview_enabled_in_production:
        process.env.NODE_ENV !== 'production' ||
        process.env.AI_PIPELINE_PREVIEW === 'true',
      manual_curate_enabled:
        process.env.NODE_ENV !== 'production' ||
        process.env.AI_MANUAL_CURATE === 'true',
      daily_curation_queue: queue,
    };
  }

  @Post('gemini-ping')
  geminiPing() {
    const allow =
      process.env.NODE_ENV !== 'production' ||
      process.env.AI_PIPELINE_PREVIEW === 'true' ||
      process.env.AI_MANUAL_CURATE === 'true';
    if (!allow) {
      throw new ForbiddenException();
    }
    return this.aiPipeline.runGeminiPing();
  }

  @Post('preview')
  preview(@CurrentUser() user: User) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.AI_PIPELINE_PREVIEW !== 'true'
    ) {
      throw new ForbiddenException();
    }
    return this.aiPipeline.previewDailyCuration(user.id);
  }

  /**
   * Same work as the daily Bull batch for one user — creates lesson (Gemini),
   * optionally publishes when AI_AUTO_PUBLISH_CURATED_LESSONS=true.
   */
  @Post('curate-me')
  curateMe(@CurrentUser() user: User) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.AI_MANUAL_CURATE !== 'true'
    ) {
      throw new ForbiddenException();
    }
    return this.aiPipeline.curateDailyContent(user.id);
  }
}
