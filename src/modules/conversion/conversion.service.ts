import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversionSignal } from './conversion-signal.entity';
import { User } from '../users/user.entity';
import { UserStreak } from '../streaks/streak.entity';
import { UserLesson } from '../lessons/user-lesson.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { SkillLevel } from '../../common/enums/skill-level.enum';

export interface ConversionSignalsPayload {
  streak_score: number;
  overload_score: number;
  session_freq: number;
  bookmarks_count: number;
}

@Injectable()
export class ConversionService {
  constructor(
    @InjectRepository(ConversionSignal)
    private readonly signalRepository: Repository<ConversionSignal>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserStreak)
    private readonly streakRepository: Repository<UserStreak>,
    @InjectRepository(UserLesson)
    private readonly userLessonRepository: Repository<UserLesson>,
    @InjectRepository(Bookmark)
    private readonly bookmarkRepository: Repository<Bookmark>,
  ) {}

  async track(
    userId: string,
    event: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const signal = this.signalRepository.create({ userId, event, metadata });
    await this.signalRepository.save(signal);
  }

  async getByUser(userId: string): Promise<ConversionSignal[]> {
    return this.signalRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private clampScore(v: number): number {
    return Math.max(1, Math.min(5, Math.round(v)));
  }

  private overloadScoreFromSkill(skill: SkillLevel): number {
    if (skill === SkillLevel.Beginner) return 4;
    if (skill === SkillLevel.Intermediate) return 3;
    return 2;
  }

  async updateSignals(userId: string): Promise<ConversionSignalsPayload> {
    const [user, streak, bookmarksCount, recentSessions] = await Promise.all([
      this.usersRepository.findOne({ where: { id: userId } }),
      this.streakRepository.findOne({ where: { userId } }),
      this.bookmarkRepository.count({ where: { userId } }),
      this.userLessonRepository
        .createQueryBuilder('ul')
        .where('ul.user_id = :userId', { userId })
        .andWhere("ul.completed_at >= (now() at time zone 'utc') - interval '7 day'")
        .getCount(),
    ]);

    const streakScore = this.clampScore((streak?.currentStreak ?? 0) / 2 || 1);
    const overloadScore = this.clampScore(
      this.overloadScoreFromSkill(user?.skillLevel ?? SkillLevel.Beginner),
    );
    const sessionFreq = this.clampScore(recentSessions || 1);
    const bookmarksScore = this.clampScore(bookmarksCount || 1);

    const payload: ConversionSignalsPayload = {
      streak_score: streakScore,
      overload_score: overloadScore,
      session_freq: sessionFreq,
      bookmarks_count: bookmarksScore,
    };
    await this.track(
      userId,
      'signals_updated',
      payload as unknown as Record<string, unknown>,
    );
    return payload;
  }

  private async getLastPromptedAt(userId: string): Promise<Date | null> {
    const row = await this.signalRepository.findOne({
      where: { userId, event: 'prompt_seen' },
      order: { createdAt: 'DESC' },
    });
    return row?.createdAt ?? null;
  }

  async predictConversion(userId: string): Promise<{
    score: number;
    trigger_prompt: boolean;
    signals: ConversionSignalsPayload;
  }> {
    const signals = await this.updateSignals(userId);
    const score =
      (signals.streak_score * 0.3 +
        signals.session_freq * 0.4 +
        signals.bookmarks_count * 0.3) /
      5;

    const lastPromptedAt = await this.getLastPromptedAt(userId);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
    const recentlyPrompted = !!lastPromptedAt && lastPromptedAt > fourteenDaysAgo;
    const trigger_prompt = score >= 0.65 && !recentlyPrompted;

    await this.track(userId, 'conversion_predicted', {
      score,
      trigger_prompt,
      ...signals,
    });
    return { score, trigger_prompt, signals };
  }

  async markPromptSeen(userId: string): Promise<{ ok: true }> {
    await this.track(userId, 'prompt_seen', { prompted_at: new Date().toISOString() });
    return { ok: true };
  }

  async markConverted(userId: string): Promise<{ ok: true }> {
    await this.track(userId, 'converted', { converted_at: new Date().toISOString() });
    return { ok: true };
  }

  calculatePrecision(tp: number, fp: number): number {
    if (tp + fp === 0) return 0;
    return tp / (tp + fp);
  }

  async getAdminAnalytics() {
    const [total_users, active_7d, active_30d, avgStreakRaw, completedToday] =
      await Promise.all([
        this.usersRepository.count(),
        this.userLessonRepository
          .createQueryBuilder('ul')
          .select('COUNT(DISTINCT ul.user_id)', 'count')
          .where("ul.completed_at >= (now() at time zone 'utc') - interval '7 day'")
          .getRawOne<{ count: string }>(),
        this.userLessonRepository
          .createQueryBuilder('ul')
          .select('COUNT(DISTINCT ul.user_id)', 'count')
          .where("ul.completed_at >= (now() at time zone 'utc') - interval '30 day'")
          .getRawOne<{ count: string }>(),
        this.streakRepository
          .createQueryBuilder('s')
          .select('AVG(s.current_streak)', 'avg')
          .getRawOne<{ avg: string | null }>(),
        this.userLessonRepository
          .createQueryBuilder('ul')
          .where(
            "ul.completed_at >= date_trunc('day', (now() at time zone 'utc'))::timestamptz",
          )
          .getCount(),
      ]);

    const convertedUsers = await this.signalRepository
      .createQueryBuilder('cs')
      .select('COUNT(DISTINCT cs.user_id)', 'count')
      .where("cs.event = 'converted'")
      .getRawOne<{ count: string }>();

    const topTopicsRows = await this.userLessonRepository
      .createQueryBuilder('ul')
      .innerJoin('lessons', 'l', 'l.id = ul.lesson_id')
      .innerJoin('topics', 't', 't.id = l.topic_id')
      .select('t.name', 'name')
      .addSelect('COUNT(*)', 'count')
      .where("ul.completed_at >= (now() at time zone 'utc') - interval '30 day'")
      .groupBy('t.name')
      .orderBy('COUNT(*)', 'DESC')
      .limit(5)
      .getRawMany<{ name: string; count: string }>();

    const conversion_rate =
      total_users === 0 ? 0 : Number(convertedUsers.count || 0) / total_users;

    return {
      total_users,
      active_7d: Number(active_7d.count || 0),
      active_30d: Number(active_30d.count || 0),
      avg_streak: Number(avgStreakRaw.avg || 0),
      lessons_completed_today: completedToday,
      conversion_rate,
      top_topics: topTopicsRows.map((r) => ({
        name: r.name,
        count: Number(r.count || 0),
      })),
    };
  }
}
