import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flashcard } from './flashcard.entity';
import { FlashcardsService } from './flashcards.service';
import { FlashcardsController } from './flashcards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Flashcard])],
  providers: [FlashcardsService],
  controllers: [FlashcardsController],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
