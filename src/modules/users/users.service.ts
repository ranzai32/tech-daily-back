import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { User } from './user.entity';
import { TopicsService } from '../topics/topics.service';
import { StreaksService } from '../streaks/streaks.service';
import { SkillLevel } from '../../common/enums/skill-level.enum';
import { Topic } from '../topics/topic.entity';
import { UserStreak } from '../streaks/streak.entity';
import { UserLesson } from '../lessons/user-lesson.entity';
import { Lesson } from '../lessons/lesson.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface ProfileResponse {
  id: string;
  email: string;
  skillLevel: SkillLevel;
  fullName: string | null;
  topics: Topic[];
  streak: Pick<UserStreak, 'currentStreak' | 'longestStreak' | 'lastActivityDate'>;
  createdAt: Date;
  updatedAt: Date;
  /** Сколько уникальных тем имеют хотя бы один завершённый урок */
  topics_with_completed_lessons: number;
}

export interface UserSettingsResponse {
  skill_level: SkillLevel;
  topic_ids: string[];
  notification_frequency: User['notificationFrequency'];
  notification_time: string;
  streak_visible: boolean;
  completed_lessons: number;
  topics_with_completed_lessons: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserLesson)
    private readonly userLessonRepository: Repository<UserLesson>,
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
    const [user, topics, streak, topicsWithDone] = await Promise.all([
      this.findById(userId),
      this.topicsService.getUserTopics(userId),
      this.streaksService.getByUser(userId),
      this.countDistinctTopicsWithCompletedLesson(userId),
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
      topics_with_completed_lessons: topicsWithDone,
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

  async getSettings(userId: string): Promise<UserSettingsResponse> {
    const [user, topics, completed, topicsWithDone] = await Promise.all([
      this.findById(userId),
      this.topicsService.getUserTopics(userId),
      this.userLessonRepository.count({
        where: { userId, completedAt: Not(IsNull()) },
      }),
      this.countDistinctTopicsWithCompletedLesson(userId),
    ]);
    return {
      skill_level: user.skillLevel,
      topic_ids: topics.map((t) => t.id),
      notification_frequency: user.notificationFrequency,
      notification_time: user.notificationTime,
      streak_visible: user.streakVisible,
      completed_lessons: completed,
      topics_with_completed_lessons: topicsWithDone,
    };
  }

  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    const patch: Partial<User> = {};
    if (dto.skill_level !== undefined) patch.skillLevel = dto.skill_level;
    if (dto.notification_frequency !== undefined) {
      patch.notificationFrequency = dto.notification_frequency;
    }
    if (dto.notification_time !== undefined) patch.notificationTime = dto.notification_time;
    if (dto.streak_visible !== undefined) patch.streakVisible = dto.streak_visible;
    if (Object.keys(patch).length > 0) {
      await this.usersRepository.update(userId, patch);
    }
    if (dto.topic_ids !== undefined) {
      await this.topicsService.saveUserTopics(userId, dto.topic_ids);
    }
    return this.getSettings(userId);
  }

  async countDistinctTopicsWithCompletedLesson(userId: string): Promise<number> {
    const row = await this.userLessonRepository
      .createQueryBuilder('ul')
      .innerJoin(Lesson, 'lesson', 'lesson.id = ul.lessonId')
      .where('ul.userId = :userId', { userId })
      .andWhere('ul.completedAt IS NOT NULL')
      .select('COUNT(DISTINCT lesson.topicId)', 'cnt')
      .getRawOne<{ cnt: string }>();
    return Number(row?.cnt ?? 0);
  }

  /** Текст для системного промпта урока Gemini. */
  async buildLessonAiProgressSnippet(userId: string): Promise<string> {
    const userTopics = await this.topicsService.getUserTopics(userId);
    const completedLessons = await this.userLessonRepository.count({
      where: { userId, completedAt: Not(IsNull()) },
    });
    const topicsTouched = await this.countDistinctTopicsWithCompletedLesson(
      userId,
    );

    const recent = await this.userLessonRepository.find({
      where: { userId, completedAt: Not(IsNull()) },
      relations: ['lesson'],
      order: { completedAt: 'DESC' },
      take: 6,
    });

    const titles = recent
      .map((r) => r.lesson?.title?.trim())
      .filter((t): t is string => !!t);

    const titlesLine =
      titles.length > 0
        ? `Недавно завершённые уроки (заголовки): ${titles.join('; ')}.`
        : 'Пользователь ещё не завершил ни одного урока.';

    return [
      `Выбрано тем интересов в профиле: ${userTopics.length}.`,
      `Всего завершённых уроков: ${completedLessons}.`,
      `Уникальных тем, по которым есть хотя бы один завершённый урок: ${topicsTouched}.`,
      titlesLine,
      'Веди урок на русском языке; не воспроизводи список заголовков дословно в теле урока.',
    ].join(' ');
  }
}
