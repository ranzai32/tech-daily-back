import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Lesson } from './lesson.entity';
import { buildRichDemoLessonBody } from './demo-lesson-body';
import { TopicsService } from '../topics/topics.service';
import { SkillLevel } from '../../common/enums/skill-level.enum';

/**
 * For each topic, inserts one published demo lesson if that topic still has none.
 * Skips in NODE_ENV=test so e2e can control lesson rows.
 */
@Injectable()
export class DemoLessonsSeedService implements OnApplicationBootstrap {
  private readonly redis: Redis | null;

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    private readonly topicsService: TopicsService,
  ) {
    const redisUrl = process.env.REDIS_URL;
    this.redis = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : null;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;

    const topics = await this.topicsService.findAll();
    if (topics.length === 0) return;

    const now = new Date();
    let inserted = false;
    for (const topic of topics) {
      const hasPublished = await this.lessonRepo.count({
        where: { topicId: topic.id, isPublished: true },
      });
      if (hasPublished > 0) continue;

      await this.lessonRepo.save(
        this.lessonRepo.create({
          title: `${topic.name}: первый шаг`,
          content: buildRichDemoLessonBody(topic.name),
          whyItMatters: `Это тема задаёт траекторию твоего ежедневного спринта. Регулярные короткие сессии по ${topic.name} дают темп без выгорания: один фокус, одно действие, закрепление карточками.`,
          topicId: topic.id,
          sourceUrl: 'https://github.com/trending',
          sourceUrls: [
            'https://github.com/trending',
            'https://news.ycombinator.com/newest',
            'https://www.reddit.com/r/programming/',
          ],
          difficulty: SkillLevel.Beginner,
          estimatedMinutes: 10,
          isPublished: true,
          reviewedAt: now,
          publishedAt: now,
          rejectionReason: null,
          curatedForUserId: null,
          flashcardsPayload: [
            {
              question: `Зачем отслеживать прогресс в «${topic.name}»?`,
              answer:
                'Чтобы видеть результат и не терять мотивацию на дистанции.',
            },
            {
              question: 'Как лучше закреплять материал после урока?',
              answer:
                'Короткое повторение через флешкарты или практический мини‑шаг.',
            },
            {
              question: 'Что делать, если тема кажется сложной?',
              answer:
                'Упростить шаг, вернуться к основам и идти маленькими циклами.',
            },
          ],
        }),
      );
      inserted = true;
    }

    if (inserted) {
      await this.clearTodayLessonRedisKeys();
    }
  }

  private async clearTodayLessonRedisKeys(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.connect();
    } catch {
      return;
    }
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          'user:*:today_lesson',
          'COUNT',
          128,
        );
        cursor = next;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
    } finally {
      await this.redis.quit().catch(() => {});
    }
  }
}
