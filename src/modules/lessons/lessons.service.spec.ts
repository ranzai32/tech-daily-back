import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { UserLesson } from './user-lesson.entity';
import { LessonsService } from './lessons.service';
import { TopicsService } from '../topics/topics.service';
import { StreaksService } from '../streaks/streaks.service';
import { ConversionService } from '../conversion/conversion.service';
import { SkillLevel } from '../../common/enums/skill-level.enum';

describe('LessonsService', () => {
  let service: LessonsService;
  let lessonRepo: jest.Mocked<
    Pick<Repository<Lesson>, 'createQueryBuilder' | 'count' | 'findOne'>
  >;
  let userLessonRepo: jest.Mocked<Pick<Repository<UserLesson>, 'find'>>;
  let topicsService: { getUserTopics: jest.Mock };

  const topicId = '11111111-1111-1111-1111-111111111111';
  const lessonId = '22222222-2222-2222-2222-222222222222';

  const makeLesson = (over: Partial<Lesson> = {}): Lesson =>
    ({
      id: lessonId,
      title: 'L',
      content: 'S',
      whyItMatters: 'W',
      topicId,
      sourceUrl: null,
      sourceUrls: null,
      difficulty: SkillLevel.Beginner,
      estimatedMinutes: 5,
      isPublished: true,
      reviewedAt: new Date(),
      publishedAt: new Date(),
      rejectionReason: null,
      curatedForUserId: null,
      flashcardsPayload: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    }) as Lesson;

  beforeEach(async () => {
    const mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    lessonRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
    };
    userLessonRepo = {
      find: jest.fn(),
    };
    topicsService = {
      getUserTopics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
        { provide: getRepositoryToken(UserLesson), useValue: userLessonRepo },
        { provide: TopicsService, useValue: topicsService },
        {
          provide: StreaksService,
          useValue: { applyStreakAfterLessonComplete: jest.fn() },
        },
        {
          provide: ConversionService,
          useValue: { updateSignals: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(LessonsService);
  });

  describe('getTodayLesson', () => {
    it('returns null when user has no topics', async () => {
      topicsService.getUserTopics.mockResolvedValue([]);
      const out = await service.getTodayLesson('u-1');
      expect(out).toEqual({ lesson: null, emptyReason: 'no_topics' });
      expect(lessonRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns the newest published lesson not completed for user topics', async () => {
      topicsService.getUserTopics.mockResolvedValue([
        { id: topicId } as never,
      ]);
      userLessonRepo.find.mockResolvedValue([]);
      const lesson = makeLesson();
      const qb = lessonRepo.createQueryBuilder();
      (qb.getOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(lesson);

      const out = await service.getTodayLesson('u-1');

      expect(out.lesson).toBe(lesson);
      expect(out.emptyReason).toBeNull();
      expect(qb.where).toHaveBeenCalledWith('l.isPublished = true');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.topicId IN (:...topicIds)',
        { topicIds: [topicId] },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('l.publishedAt', 'DESC');
      expect(qb.getOne).toHaveBeenCalledTimes(2);
    });

    it('prefers curated-for-user lesson when both exist', async () => {
      topicsService.getUserTopics.mockResolvedValue([
        { id: topicId } as never,
      ]);
      userLessonRepo.find.mockResolvedValue([]);
      const generic = makeLesson({ id: '33333333-3333-3333-3333-333333333333' });
      const curated = makeLesson({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'AI Curated',
        curatedForUserId: 'u-target',
      });
      const qb = lessonRepo.createQueryBuilder();
      (qb.getOne as jest.Mock)
        .mockResolvedValueOnce(curated)
        .mockResolvedValueOnce(generic);

      const out = await service.getTodayLesson('u-target');

      expect(out.lesson?.id).toBe(curated.id);
      expect(qb.getOne).toHaveBeenCalledTimes(1);
    });

    it('excludes completed lesson ids from query', async () => {
      topicsService.getUserTopics.mockResolvedValue([
        { id: topicId } as never,
      ]);
      userLessonRepo.find.mockResolvedValue([
        { lessonId: 'done-id' } as UserLesson,
      ]);
      const qb = lessonRepo.createQueryBuilder();
      (qb.getOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (lessonRepo.count as jest.Mock).mockResolvedValue(4);

      const out = await service.getTodayLesson('u-1');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'l.id NOT IN (:...completedIds)',
        { completedIds: ['done-id'] },
      );
      expect(out).toEqual({
        lesson: null,
        emptyReason: 'all_completed',
      });
    });
  });
});
