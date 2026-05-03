import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { UserLesson } from './user-lesson.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SkillLevel } from '../../common/enums/skill-level.enum';
import type { LessonInteractivePayload } from './lesson-interactive.types';
import { TopicsService } from '../topics/topics.service';
import { StreaksService } from '../streaks/streaks.service';
import { UserStreak } from '../streaks/streak.entity';
import { ConversionService } from '../conversion/conversion.service';
import Redis from 'ioredis';

export interface AiLessonDraftInput {
  title: string;
  summary: string;
  whyItMatters: string;
  sourceUrls: string[];
  flashcards: { question: string; answer: string }[];
  topicId: string;
  difficulty: SkillLevel;
  curatedForUserId: string;
  interactivePayload?: LessonInteractivePayload | null;
}

/** Текстовое представление всего материала (для истории/API). */
export function concatLessonBodies(
  summary: string,
  payload: LessonInteractivePayload | null | undefined,
): string {
  const s = (summary ?? '').trim();
  if (!payload?.phases?.length) return s || 'Урок без текста.';
  const parts = payload.phases.map((ph, idx) => {
    const cx =
      ph.code_examples?.filter(Boolean).length > 0
        ? ph.code_examples
            .filter(Boolean)
            .map((code) => ['```', code.trim(), '```'].join('\n'))
            .join('\n\n')
        : '';
    return [`### Часть ${idx + 1}`, ph.theory.trim(), cx]
      .filter(Boolean)
      .join('\n\n');
  });
  return [s, ...parts].filter(Boolean).join('\n\n---\n\n');
}

export function resolveLessonSourceUrls(lesson: Lesson): string[] {
  if (lesson.sourceUrls?.length) return lesson.sourceUrls;
  if (lesson.sourceUrl) return [lesson.sourceUrl];
  return [];
}

export type TodayLessonEmptyReason =
  | 'no_topics'
  | 'no_published_for_topics'
  | 'all_completed';

export interface TodayLessonOutcome {
  lesson: Lesson | null;
  /** When lesson is non-null this is always null */
  emptyReason: TodayLessonEmptyReason | null;
}

@Injectable()
export class LessonsService {
  private readonly redis: Redis | null;

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(UserLesson)
    private readonly userLessonRepository: Repository<UserLesson>,
    private readonly topicsService: TopicsService,
    private readonly streaksService: StreaksService,
    private readonly conversionService: ConversionService,
  ) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.redis = null;
      return;
    }
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.connect().catch(() => {
      // Keep app functional even if Redis is down.
    });
  }

  private todayLessonCacheKey(userId: string): string {
    return `user:${userId}:today_lesson`;
  }

  /** Drops cached GET /lessons/today result for this user (e.g. after publishing a new lesson). */
  async invalidateTodayLessonCache(userId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(this.todayLessonCacheKey(userId));
    } catch {
      // ignore
    }
  }

  async findAll(pagination: PaginationDto): Promise<[Lesson[], number]> {
    const { page, limit } = pagination;
    return this.lessonRepository.findAndCount({
      where: { isPublished: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findPendingReview(): Promise<Lesson[]> {
    return this.lessonRepository.find({
      where: { reviewedAt: IsNull(), rejectionReason: IsNull() },
      order: { createdAt: 'ASC' },
      relations: ['topic'],
    });
  }

  async findLastApprovedByTopic(topicId: string): Promise<Lesson | null> {
    return this.lessonRepository.findOne({
      where: {
        topicId,
        reviewedAt: Not(IsNull()),
        rejectionReason: IsNull(),
        isPublished: true,
      },
      order: { publishedAt: 'DESC', updatedAt: 'DESC' },
    });
  }

  async createAiDraft(input: AiLessonDraftInput): Promise<Lesson> {
    const urls = input.sourceUrls ?? [];
    const sourceUrl = urls[0] ?? null;
    const hasFlow = !!input.interactivePayload?.phases?.length;
    const lesson = this.lessonRepository.create({
      title: input.title,
      content: concatLessonBodies(input.summary, input.interactivePayload ?? null),
      whyItMatters: input.whyItMatters,
      topicId: input.topicId,
      sourceUrl,
      sourceUrls: urls.length ? urls : null,
      difficulty: input.difficulty,
      estimatedMinutes: hasFlow ? 35 : 5,
      isPublished: false,
      reviewedAt: null,
      publishedAt: null,
      rejectionReason: null,
      curatedForUserId: input.curatedForUserId,
      flashcardsPayload: input.flashcards,
      interactivePayload: input.interactivePayload ?? null,
    });
    return this.lessonRepository.save(lesson);
  }

  async cloneFallbackDraft(
    source: Lesson,
    curatedForUserId: string,
  ): Promise<Lesson> {
    const sourceUrls =
      source.sourceUrls?.length
        ? source.sourceUrls
        : source.sourceUrl
          ? [source.sourceUrl]
          : null;
    const lesson = this.lessonRepository.create({
      title: source.title,
      content: source.content,
      whyItMatters: source.whyItMatters,
      topicId: source.topicId,
      sourceUrl: source.sourceUrl,
      sourceUrls,
      difficulty: source.difficulty,
      estimatedMinutes: source.estimatedMinutes,
      isPublished: false,
      reviewedAt: null,
      publishedAt: null,
      rejectionReason: null,
      curatedForUserId,
      flashcardsPayload: source.flashcardsPayload,
      interactivePayload: source.interactivePayload ?? null,
    });
    return this.lessonRepository.save(lesson);
  }

  async approveLesson(id: string): Promise<Lesson> {
    const lesson = await this.findById(id);
    const now = new Date();
    lesson.reviewedAt = now;
    lesson.publishedAt = now;
    lesson.isPublished = true;
    lesson.rejectionReason = null;
    return this.lessonRepository.save(lesson);
  }

  async rejectLesson(id: string, reason: string): Promise<Lesson> {
    const lesson = await this.findById(id);
    const now = new Date();
    lesson.reviewedAt = now;
    lesson.rejectionReason = reason;
    lesson.isPublished = false;
    lesson.publishedAt = null;
    return this.lessonRepository.save(lesson);
  }

  async findById(id: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async findByTopic(topicId: string): Promise<Lesson[]> {
    return this.lessonRepository.find({
      where: { topicId, isPublished: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(data: Partial<Lesson>): Promise<Lesson> {
    const lesson = this.lessonRepository.create(data);
    return this.lessonRepository.save(lesson);
  }

  private async userTopicIds(userId: string): Promise<string[]> {
    const topics = await this.topicsService.getUserTopics(userId);
    return topics.map((t) => t.id);
  }

  private async hasUserLesson(userId: string, lessonId: string): Promise<boolean> {
    const row = await this.userLessonRepository.findOne({
      where: { userId, lessonId },
    });
    return !!row;
  }

  async canAccessLesson(userId: string, lesson: Lesson): Promise<boolean> {
    if (!lesson.isPublished) return false;
    const topicIds = await this.userTopicIds(userId);
    if (topicIds.includes(lesson.topicId)) return true;
    return this.hasUserLesson(userId, lesson.id);
  }

  async canCompleteLesson(userId: string, lesson: Lesson): Promise<boolean> {
    if (!lesson.isPublished) return false;
    const topicIds = await this.userTopicIds(userId);
    return topicIds.includes(lesson.topicId);
  }

  toLessonSummary(lesson: Lesson) {
    return {
      id: lesson.id,
      title: lesson.title,
      summary: lesson.content,
      whyItMatters: lesson.whyItMatters,
      topicId: lesson.topicId,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      sourceUrls: resolveLessonSourceUrls(lesson),
    };
  }

  async getTodayLesson(userId: string): Promise<TodayLessonOutcome> {
    const topicIds = await this.userTopicIds(userId);
    if (!topicIds.length) {
      return { lesson: null, emptyReason: 'no_topics' };
    }

    const completedRows = await this.userLessonRepository.find({
      where: { userId, completedAt: Not(IsNull()) },
      select: ['lessonId'],
    });
    const completedIds = new Set(completedRows.map((r) => r.lessonId));

    const cacheKey = this.todayLessonCacheKey(userId);

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached && cached !== '__NONE__') {
          const cand = await this.lessonRepository.findOne({
            where: { id: cached, isPublished: true },
          });
          if (
            cand &&
            topicIds.includes(cand.topicId) &&
            !completedIds.has(cand.id)
          ) {
            return { lesson: cand, emptyReason: null };
          }
          await this.redis.del(cacheKey);
        } else if (cached === '__NONE__') {
          /** Stale: lessons/topics may appear after seed; do not skip DB for up to an hour */
          await this.redis.del(cacheKey);
        }
      } catch {
        /** Redis unreachable — bypass cache */
      }
    }

    const completedIdsArr = [...completedIds];
    const baseQb = () => {
      const qb = this.lessonRepository
        .createQueryBuilder('l')
        .where('l.isPublished = true')
        .andWhere('l.topicId IN (:...topicIds)', { topicIds });
      if (completedIdsArr.length) {
        qb.andWhere('l.id NOT IN (:...completedIds)', {
          completedIds: completedIdsArr,
        });
      }
      return qb;
    };

    /** Сначала персональные AI-уроки (curate-me / джоба), чтобы не залипать на демо «: первый шаг». */
    let lesson = await baseQb()
      .andWhere('l.curatedForUserId = :userId', { userId })
      .orderBy('l.publishedAt', 'DESC')
      .addOrderBy('l.createdAt', 'DESC')
      .getOne();

    if (!lesson) {
      lesson = await baseQb()
        .orderBy('l.publishedAt', 'DESC')
        .addOrderBy('l.createdAt', 'DESC')
        .getOne();
    }

    if (!lesson) {
      const publishedCount = await this.lessonRepository.count({
        where: { isPublished: true, topicId: In(topicIds) },
      });
      const emptyReason: TodayLessonEmptyReason =
        publishedCount === 0
          ? 'no_published_for_topics'
          : 'all_completed';
      if (this.redis) {
        try {
          await this.redis.set(cacheKey, '__NONE__', 'EX', 120);
        } catch {
          //
        }
      }
      return { lesson: null, emptyReason };
    }

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, lesson.id, 'EX', 3600);
      } catch {
        //
      }
    }
    return { lesson, emptyReason: null };
  }

  async getLessonHistory(
    userId: string,
    pagination: PaginationDto,
  ): Promise<[Array<{ lesson: Lesson; completedAt: Date }>, number]> {
    const { page, limit } = pagination;
    const qb = this.userLessonRepository
      .createQueryBuilder('ul')
      .innerJoinAndSelect('ul.lesson', 'lesson')
      .where('ul.userId = :userId', { userId })
      .andWhere('ul.completedAt IS NOT NULL')
      .orderBy('ul.completedAt', 'DESC');

    const total = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const items = rows.map((ul) => ({
      lesson: ul.lesson,
      completedAt: ul.completedAt as Date,
    }));
    return [items, total];
  }

  async completeLesson(
    userId: string,
    lessonId: string,
  ): Promise<{ streak: UserStreak; alreadyCompleted: boolean }> {
    const lesson = await this.findById(lessonId);
    if (!(await this.canCompleteLesson(userId, lesson))) {
      throw new ForbiddenException('Cannot complete this lesson');
    }

    let row = await this.userLessonRepository.findOne({
      where: { userId, lessonId },
    });
    const alreadyCompleted = !!row?.completedAt;

    if (!alreadyCompleted) {
      const now = new Date();
      if (!row) {
        row = this.userLessonRepository.create({
          userId,
          lessonId,
          completedAt: now,
        });
      } else {
        row.completedAt = now;
      }
      await this.userLessonRepository.save(row);
      if (this.redis) {
        await this.redis.del(this.todayLessonCacheKey(userId));
      }
    }

    const streak = alreadyCompleted
      ? await this.streaksService.getByUser(userId)
      : await this.streaksService.applyStreakAfterLessonComplete(userId);
    if (!alreadyCompleted) {
      await this.conversionService.updateSignals(userId);
    }

    return { streak, alreadyCompleted };
  }

  async getLessonDetailForUser(userId: string, lessonId: string) {
    const lesson = await this.findById(lessonId);
    if (!(await this.canAccessLesson(userId, lesson))) {
      throw new ForbiddenException('Cannot access this lesson');
    }
    return {
      id: lesson.id,
      title: lesson.title,
      summary: lesson.content,
      whyItMatters: lesson.whyItMatters,
      topicId: lesson.topicId,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      sourceUrls: resolveLessonSourceUrls(lesson),
      flashcards: lesson.flashcardsPayload ?? [],
      publishedAt: lesson.publishedAt,
      interactive: lesson.interactivePayload ?? null,
    };
  }
}
