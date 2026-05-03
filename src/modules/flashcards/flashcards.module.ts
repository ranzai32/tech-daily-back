import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flashcard } from './flashcard.entity';
import { UserLesson } from '../lessons/user-lesson.entity';
import { FlashcardsService } from './flashcards.service';
import { FlashcardsController } from './flashcards.controller';
import { LessonsModule } from '../lessons/lessons.module';

@Module({
  imports: [TypeOrmModule.forFeature([Flashcard, UserLesson]), LessonsModule],
  providers: [FlashcardsService],
  controllers: [FlashcardsController],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
