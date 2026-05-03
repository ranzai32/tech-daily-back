import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LessonsService, resolveLessonSourceUrls } from './lessons.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { Response } from 'express';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('today')
  async getToday(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    /** Иначе браузер может минуты держать прошлый ответ без урока после POST curate-me + reload. */
    res.setHeader('Cache-Control', 'private, no-store');
    const { lesson, emptyReason } = await this.lessonsService.getTodayLesson(
      user.id,
    );
    return {
      lesson: lesson ? this.lessonsService.toLessonSummary(lesson) : null,
      empty_reason: emptyReason,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ) {
    const [items, total] = await this.lessonsService.getLessonHistory(
      user.id,
      pagination,
    );
    const { page, limit } = pagination;
    return {
      items: items.map(({ lesson, completedAt }) => ({
        ...this.lessonsService.toLessonSummary(lesson),
        completedAt,
      })),
      total,
      page,
      limit,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('topic/:topicId')
  findByTopic(@Param('topicId') topicId: string) {
    return this.lessonsService.findByTopic(topicId).then((lessons) =>
      lessons.map((l) => ({
        ...l,
        sourceUrls: resolveLessonSourceUrls(l),
      })),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.lessonsService.findAll(pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/complete')
  async complete(@CurrentUser() user: User, @Param('id') id: string) {
    const { streak, alreadyCompleted } =
      await this.lessonsService.completeLesson(user.id, id);
    return { streak, alreadyCompleted };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.lessonsService.getLessonDetailForUser(user.id, id);
  }
}
