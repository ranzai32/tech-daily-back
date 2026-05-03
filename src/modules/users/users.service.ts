import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { TopicsService } from '../topics/topics.service';
import { StreaksService } from '../streaks/streaks.service';
import { SkillLevel } from '../../common/enums/skill-level.enum';
import { Topic } from '../topics/topic.entity';
import { UserStreak } from '../streaks/streak.entity';

export interface ProfileResponse {
  id: string;
  email: string;
  skillLevel: SkillLevel;
  fullName: string | null;
  topics: Topic[];
  streak: Pick<UserStreak, 'currentStreak' | 'longestStreak' | 'lastActivityDate'>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly topicsService: TopicsService,
    private readonly streaksService: StreaksService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.findById(id);
  }

  async getProfile(userId: string): Promise<ProfileResponse> {
    const [user, topics, streak] = await Promise.all([
      this.findById(userId),
      this.topicsService.getUserTopics(userId),
      this.streaksService.getByUser(userId),
    ]);
    return {
      id: user.id,
      email: user.email,
      skillLevel: user.skillLevel,
      fullName: user.fullName,
      topics,
      streak: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActivityDate: streak.lastActivityDate,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(
    userId: string,
    data: { skill_level?: SkillLevel; full_name?: string },
  ): Promise<User> {
    const patch: Partial<User> = {};
    if (data.skill_level !== undefined) patch.skillLevel = data.skill_level;
    if (data.full_name !== undefined) patch.fullName = data.full_name;
    return this.update(userId, patch);
  }
}
