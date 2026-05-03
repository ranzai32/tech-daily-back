import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UserStreak } from './streak.entity';
import { UserLesson } from '../lessons/user-lesson.entity';

export interface StreakMePayload {
  current_streak: number;
  longest_streak: number;
  grace_used_today: boolean;
  /** UTC calendar days, oldest → newest (today last); completion that day */
  week_activity: boolean[];
}

export function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function diffUtcCalendarDays(later: Date, earlier: Date): number {
  const a = utcDayStart(later).getTime();
  const b = utcDayStart(earlier).getTime();
  return Math.round((a - b) / 86400000);
}

export function graceUsedTodayUtc(
  graceUsedOnDate: Date | string | null,
  today: Date,
): boolean {
  if (!graceUsedOnDate) return false;
  return diffUtcCalendarDays(today, new Date(graceUsedOnDate)) === 0;
}

export function sameUtcCalendarDay(
  a: Date | string | null,
  b: Date | string | null,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return utcDayStart(new Date(a)).getTime() === utcDayStart(new Date(b)).getTime();
}

export function applyStreakOnLessonComplete(
  streak: Pick<
    UserStreak,
    'currentStreak' | 'longestStreak' | 'lastActivityDate' | 'graceUsedOnDate'
  >,
  today: Date,
): Pick<UserStreak, 'currentStreak' | 'longestStreak' | 'lastActivityDate' | 'graceUsedOnDate'> {
  const t = utcDayStart(today);
  const last = streak.lastActivityDate
    ? utcDayStart(new Date(streak.lastActivityDate))
    : null;

  if (last && diffUtcCalendarDays(t, last) === 0) {
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActivityDate: streak.lastActivityDate,
      graceUsedOnDate: streak.graceUsedOnDate,
    };
  }

  const graceToday = graceUsedTodayUtc(streak.graceUsedOnDate, t);
  let next: number;
  let nextGrace: Date | null = streak.graceUsedOnDate;

  if (!last) {
    next = 1;
  } else {
    const diff = diffUtcCalendarDays(t, last);
    if (diff === 1) {
      next = streak.currentStreak + 1;
    } else if (diff === 2) {
      if (!graceToday) {
        next = streak.currentStreak + 1;
        nextGrace = t;
      } else {
        next = 1;
        nextGrace = null;
      }
    } else {
      next = 1;
      nextGrace = null;
    }
  }

  const longest = Math.max(streak.longestStreak, next);
  return {
    currentStreak: next,
    longestStreak: longest,
    lastActivityDate: t,
    graceUsedOnDate: nextGrace,
  };
}

@Injectable()
export class StreaksService {
  constructor(
    @InjectRepository(UserStreak)
    private readonly streakRepository: Repository<UserStreak>,
    @InjectRepository(UserLesson)
    private readonly userLessonRepository: Repository<UserLesson>,
  ) {}

  async getMePayload(userId: string): Promise<StreakMePayload> {
    const streak = await this.getByUser(userId);
    const today = new Date();
    const week_activity = await this.getWeekCompletionFlags(userId, today);
    return {
      current_streak: streak.currentStreak,
      longest_streak: streak.longestStreak,
      grace_used_today: graceUsedTodayUtc(streak.graceUsedOnDate, today),
      week_activity,
    };
  }

  private async getWeekCompletionFlags(
    userId: string,
    today: Date,
  ): Promise<boolean[]> {
    const today0 = utcDayStart(today);
    const startDay = new Date(today0.getTime());
    startDay.setUTCDate(startDay.getUTCDate() - 6);

    const rows = await this.userLessonRepository.find({
      where: {
        userId,
        completedAt: MoreThanOrEqual(startDay),
      },
      select: ['completedAt'],
    });

    const done = new Set<string>();
    for (const r of rows) {
      if (!r.completedAt) continue;
      const key = utcDayStart(new Date(r.completedAt))
        .toISOString()
        .slice(0, 10);
      done.add(key);
    }

    const flags: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDay.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      flags.push(done.has(d.toISOString().slice(0, 10)));
    }
    return flags;
  }

  async getByUser(userId: string): Promise<UserStreak> {
    let streak = await this.streakRepository.findOne({ where: { userId } });
    if (!streak) {
      streak = await this.streakRepository.save(
        this.streakRepository.create({ userId }),
      );
    }
    return streak;
  }

  async updateStreak(userId: string): Promise<UserStreak> {
    return this.applyStreakAfterLessonComplete(userId);
  }

  async applyStreakAfterLessonComplete(userId: string): Promise<UserStreak> {
    const streak = await this.getByUser(userId);
    const today = new Date();
    const patch = applyStreakOnLessonComplete(streak, today);
    if (
      patch.currentStreak === streak.currentStreak &&
      patch.longestStreak === streak.longestStreak &&
      sameUtcCalendarDay(patch.lastActivityDate, streak.lastActivityDate) &&
      sameUtcCalendarDay(patch.graceUsedOnDate, streak.graceUsedOnDate)
    ) {
      return streak;
    }
    streak.currentStreak = patch.currentStreak;
    streak.longestStreak = patch.longestStreak;
    streak.lastActivityDate = patch.lastActivityDate;
    streak.graceUsedOnDate = patch.graceUsedOnDate;
    return this.streakRepository.save(streak);
  }
}
