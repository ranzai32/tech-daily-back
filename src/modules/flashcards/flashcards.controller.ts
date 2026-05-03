import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsNumber, IsUUID, IsString, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FlashcardsService } from './flashcards.service';
import { User } from '../users/user.entity';
import { CompletedFlashcardsQueryDto } from './dto/completed-flashcards-query.dto';

class CreateFlashcardDto {
  @IsUUID()
  lessonId: string;

  @IsString()
  question: string;

  @IsString()
  answer: string;
}

class ReviewFlashcardDto {
  @IsNumber()
  @Min(0)
  @Max(5)
  quality: number;
}

@UseGuards(JwtAuthGuard)
@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Get('due')
  getDue(@CurrentUser() user: User) {
    return this.flashcardsService.getDueForReview(user.id);
  }

  /** Карточки из пройденных уроков (по одной на страницу по умолчанию). */
  @Get('from-completed')
  getFromCompleted(
    @CurrentUser() user: User,
    @Query() query: CompletedFlashcardsQueryDto,
  ) {
    return this.flashcardsService.getFlashcardsFromCompletedLessonsPaginated(
      user.id,
      query.page,
      query.limit,
    );
  }

  @Get(':lessonId')
  getForLesson(
    @CurrentUser() user: User,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.flashcardsService.getFlashcardsForLesson(user.id, lessonId);
  }

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.flashcardsService.getByUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateFlashcardDto) {
    return this.flashcardsService.create(
      user.id,
      dto.lessonId,
      dto.question,
      dto.answer,
    );
  }

  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewFlashcardDto) {
    return this.flashcardsService.review(id, dto.quality);
  }
}
