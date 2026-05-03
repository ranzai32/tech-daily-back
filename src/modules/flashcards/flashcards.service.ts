import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Flashcard } from './flashcard.entity';
import { Lesson } from '../lessons/lesson.entity';
import { LessonsService } from '../lessons/lessons.service';
import { UserLesson } from '../lessons/user-lesson.entity';

export interface LessonFlashcardItem {
  id: string;
  question: string;
  answer: string;
}

export interface CompletedLessonFlashcardItem extends LessonFlashcardItem {
  lessonId: string;
  lessonTitle: string;
}

export interface CompletedFlashcardsPageDto {
  items: CompletedLessonFlashcardItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(UserLesson)
    private readonly userLessonRepository: Repository<UserLesson>,
    private readonly lessonsService: LessonsService,
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

  async getFlashcardsForLesson(
    userId: string,
    lessonId: string,
  ): Promise<LessonFlashcardItem[]> {
    const lesson = await this.lessonsService.findById(lessonId);
    if (!(await this.lessonsService.canAccessLesson(userId, lesson))) {
      throw new ForbiddenException('Cannot access this lesson');
    }
    return this.lessonPayloadToItems(lesson);
  }

  /** Карточки из пройденных уроков (payload урока), плоский список с пагинацией. */
  async getFlashcardsFromCompletedLessonsPaginated(
    userId: string,
    page: number,
    limit: number,
  ): Promise<CompletedFlashcardsPageDto> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 1);

    const rows = await this.userLessonRepository.find({
      where: { userId, completedAt: Not(IsNull()) },
      relations: ['lesson'],
      order: { completedAt: 'DESC' },
    });

    const flat: CompletedLessonFlashcardItem[] = [];
    for (const ul of rows) {
      const lesson = ul.lesson;
      if (!lesson) continue;
      const items = this.lessonPayloadToItems(lesson);
      for (const it of items) {
        flat.push({
          ...it,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        });
      }
    }

    const total = flat.length;
    const totalPages = total ? Math.ceil(total / safeLimit) : 0;
    const start = (safePage - 1) * safeLimit;
    const items = flat.slice(start, start + safeLimit);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  private lessonPayloadToItems(lesson: Lesson): LessonFlashcardItem[] {
    const trimmed =
      lesson.flashcardsPayload?.filter(
        (fc) => fc.question?.trim() && fc.answer?.trim(),
      ) ?? [];
    const source =
      trimmed.length > 0 ? trimmed : this.syntheticCardsFromLesson(lesson);
    return source.map((fc, i) => ({
      id: `${lesson.id}-${i}`,
      question: fc.question,
      answer: fc.answer,
    }));
  }

  /**
   * Если в уроке нет сохранённых карточек (старый драфт или пустой payload),
   * даём короткий набор для экрана повторения сразу после complete.
   */
  private syntheticCardsFromLesson(
    lesson: Lesson,
  ): { question: string; answer: string }[] {
    const titleShort =
      lesson.title.length > 110
        ? `${lesson.title.slice(0, 107)}…`
        : lesson.title;
    const why = lesson.whyItMatters?.replace(/\s+/g, ' ').trim().slice(0, 520) ?? '';
    const excerpt = lesson.content
      ? lesson.content.replace(/\s+/g, ' ').trim().slice(0, 520)
      : '';

    const mainAnswer =
      why ||
      excerpt ||
      'Вернись к материалу урока и сформулируй главную мысль одним предложением.';

    const cards: { question: string; answer: string }[] = [
      {
        question: `В чём суть темы «${titleShort}»?`,
        answer: mainAnswer,
      },
      {
        question:
          'Какой маленький шаг ты сможешь сделать по этому материалу сегодня?',
        answer: 'Действие на 15–30 минут без отвлечений — лучше, чем «изучить всё».',
      },
    ];

    if (
      why &&
      excerpt &&
      excerpt.slice(0, 100).toLowerCase() !== why.slice(0, 100).toLowerCase()
    ) {
      cards.push({
        question:
          'Перескажи одну ключевую идею из урока простыми словами для новичка.',
        answer: excerpt.slice(0, 560),
      });
    }

    return cards;
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
