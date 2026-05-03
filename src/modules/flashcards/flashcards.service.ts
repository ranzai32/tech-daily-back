import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Flashcard } from './flashcard.entity';

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
  ) {}

  async getByUser(userId: string): Promise<Flashcard[]> {
    return this.flashcardRepository.find({ where: { userId } });
  }

  async getDueForReview(userId: string): Promise<Flashcard[]> {
    return this.flashcardRepository.find({
      where: {
        userId,
        nextReviewAt: LessThanOrEqual(new Date()),
      },
    });
  }

  async create(
    userId: string,
    lessonId: string,
    question: string,
    answer: string,
  ): Promise<Flashcard> {
    const flashcard = this.flashcardRepository.create({
      userId,
      lessonId,
      question,
      answer,
      nextReviewAt: new Date(),
    });
    return this.flashcardRepository.save(flashcard);
  }

  async review(id: string, quality: number): Promise<Flashcard> {
    const card = await this.flashcardRepository.findOne({ where: { id } });
    if (!card) throw new NotFoundException('Flashcard not found');

    const { easeFactor, repetitions, interval } = this.sm2(card, quality);
    card.easeFactor = easeFactor;
    card.repetitions = repetitions;
    card.interval = interval;
    card.nextReviewAt = new Date(Date.now() + interval * 86400000);

    return this.flashcardRepository.save(card);
  }

  private sm2(
    card: Flashcard,
    quality: number,
  ): { easeFactor: number; repetitions: number; interval: number } {
    let { easeFactor, repetitions, interval } = card;

    if (quality >= 3) {
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }

    easeFactor = Math.max(
      1.3,
      easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
    );

    return { easeFactor, repetitions, interval };
  }
}
