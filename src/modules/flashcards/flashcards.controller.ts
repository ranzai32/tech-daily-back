import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { IsNumber, IsUUID, IsString, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FlashcardsService } from './flashcards.service';
import { User } from '../users/user.entity';

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

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.flashcardsService.getByUser(user.id);
  }

  @Get('due')
  getDue(@CurrentUser() user: User) {
    return this.flashcardsService.getDueForReview(user.id);
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
