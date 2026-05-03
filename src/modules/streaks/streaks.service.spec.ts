import {
  applyStreakOnLessonComplete,
  diffUtcCalendarDays,
  graceUsedTodayUtc,
  utcDayStart,
} from './streaks.service';
import { UserStreak } from './streak.entity';

function streak(
  partial: Partial<
    Pick<
      UserStreak,
      'currentStreak' | 'longestStreak' | 'lastActivityDate' | 'graceUsedOnDate'
    >
  >,
): Pick<
  UserStreak,
  'currentStreak' | 'longestStreak' | 'lastActivityDate' | 'graceUsedOnDate'
> {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    graceUsedOnDate: null,
    ...partial,
  };
}

describe('streaks helpers', () => {
  it('utcDayStart normalizes to UTC midnight', () => {
    const d = new Date(Date.UTC(2026, 4, 4, 15, 30));
    expect(utcDayStart(d).toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('diffUtcCalendarDays counts calendar days', () => {
    const a = new Date(Date.UTC(2026, 4, 4));
    const b = new Date(Date.UTC(2026, 4, 3));
    expect(diffUtcCalendarDays(a, b)).toBe(1);
    expect(diffUtcCalendarDays(b, a)).toBe(-1);
  });

  it('graceUsedTodayUtc is true only when grace date is same UTC day as today', () => {
    const today = new Date(Date.UTC(2026, 4, 4, 10));
    expect(graceUsedTodayUtc(new Date(Date.UTC(2026, 4, 4)), today)).toBe(true);
    expect(graceUsedTodayUtc(new Date(Date.UTC(2026, 4, 3)), today)).toBe(false);
  });
});

describe('applyStreakOnLessonComplete', () => {
  const today = new Date(Date.UTC(2026, 4, 4, 12));
  const yesterday = new Date(Date.UTC(2026, 4, 3));
  const dayBefore = new Date(Date.UTC(2026, 4, 2));

  it('first completion sets streak to 1', () => {
    const out = applyStreakOnLessonComplete(streak({}), today);
    expect(out.currentStreak).toBe(1);
    expect(out.longestStreak).toBe(1);
    expect(out.lastActivityDate?.toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('when last activity was yesterday, increments streak', () => {
    const out = applyStreakOnLessonComplete(
      streak({
        currentStreak: 4,
        longestStreak: 4,
        lastActivityDate: yesterday,
        graceUsedOnDate: null,
      }),
      today,
    );
    expect(out.currentStreak).toBe(5);
    expect(out.longestStreak).toBe(5);
  });

  it('when last activity is today, leaves streak unchanged', () => {
    const base = streak({
      currentStreak: 7,
      longestStreak: 10,
      lastActivityDate: today,
      graceUsedOnDate: null,
    });
    const out = applyStreakOnLessonComplete(base, today);
    expect(out).toEqual(base);
  });

  it('when gap is two days and grace not used today, increments and records grace', () => {
    const out = applyStreakOnLessonComplete(
      streak({
        currentStreak: 3,
        longestStreak: 3,
        lastActivityDate: dayBefore,
        graceUsedOnDate: null,
      }),
      today,
    );
    expect(out.currentStreak).toBe(4);
    expect(out.graceUsedOnDate?.toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('when gap is two days but grace already used today, resets to 1', () => {
    const out = applyStreakOnLessonComplete(
      streak({
        currentStreak: 8,
        longestStreak: 8,
        lastActivityDate: dayBefore,
        graceUsedOnDate: today,
      }),
      today,
    );
    expect(out.currentStreak).toBe(1);
    expect(out.graceUsedOnDate).toBeNull();
  });

  it('when gap is three or more days, resets streak', () => {
    const last = new Date(Date.UTC(2026, 4, 0));
    const out = applyStreakOnLessonComplete(
      streak({
        currentStreak: 9,
        longestStreak: 9,
        lastActivityDate: last,
        graceUsedOnDate: null,
      }),
      today,
    );
    expect(out.currentStreak).toBe(1);
    expect(out.graceUsedOnDate).toBeNull();
  });

  it('updates longest_streak when current exceeds it', () => {
    const out = applyStreakOnLessonComplete(
      streak({
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: yesterday,
        graceUsedOnDate: null,
      }),
      today,
    );
    expect(out.currentStreak).toBe(3);
    expect(out.longestStreak).toBe(3);
  });

  it('does not shrink longest_streak when current dips after reset', () => {
    const out = applyStreakOnLessonComplete(
      streak({
        currentStreak: 5,
        longestStreak: 20,
        lastActivityDate: new Date(Date.UTC(2026, 3, 1)),
        graceUsedOnDate: null,
      }),
      today,
    );
    expect(out.currentStreak).toBe(1);
    expect(out.longestStreak).toBe(20);
  });
});
