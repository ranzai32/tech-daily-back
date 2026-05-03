import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStreak } from './streak.entity';

@Injectable()
export class StreaksService {
  constructor(
    @InjectRepository(UserStreak)
    private readonly streakRepository: Repository<UserStreak>,
  ) {}

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
    const streak = await this.getByUser(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActivity = streak.lastActivityDate
      ? new Date(streak.lastActivityDate)
      : null;

    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
      const diff = Math.floor(
        (today.getTime() - lastActivity.getTime()) / 86400000,
      );
      if (diff === 0) return streak;
      streak.currentStreak = diff === 1 ? streak.currentStreak + 1 : 1;
    } else {
      streak.currentStreak = 1;
    }

    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastActivityDate = today;

    return this.streakRepository.save(streak);
  }
}
