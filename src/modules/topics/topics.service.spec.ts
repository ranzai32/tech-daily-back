import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TopicsService } from './topics.service';
import { Topic } from './topic.entity';
import { UserTopic } from './user-topic.entity';

const makeTopic = (id: string, name: string): Topic =>
  ({ id, name, slug: name.toLowerCase(), description: null, iconUrl: null, createdAt: new Date() }) as Topic;

const makeUserTopic = (userId: string, topicId: string, topic: Topic): UserTopic =>
  ({ id: 'ut-' + topicId, userId, topicId, topic, createdAt: new Date() }) as UserTopic;

describe('TopicsService', () => {
  let service: TopicsService;

  const mockTopicRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockUserTopicRepo = {
    find: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicsService,
        { provide: getRepositoryToken(Topic), useValue: mockTopicRepo },
        { provide: getRepositoryToken(UserTopic), useValue: mockUserTopicRepo },
      ],
    }).compile();

    service = module.get<TopicsService>(TopicsService);
    jest.clearAllMocks();
  });

  describe('getUserTopics', () => {
    it('returns topics for a user', async () => {
      const topic1 = makeTopic('t-1', 'React');
      const topic2 = makeTopic('t-2', 'TypeScript');
      mockUserTopicRepo.find.mockResolvedValue([
        makeUserTopic('u-1', 't-1', topic1),
        makeUserTopic('u-1', 't-2', topic2),
      ]);

      const result = await service.getUserTopics('u-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('React');
      expect(result[1].name).toBe('TypeScript');
    });

    it('returns empty array when user has no topics', async () => {
      mockUserTopicRepo.find.mockResolvedValue([]);

      const result = await service.getUserTopics('u-1');

      expect(result).toEqual([]);
    });

    it('queries with correct userId and relations', async () => {
      mockUserTopicRepo.find.mockResolvedValue([]);

      await service.getUserTopics('user-abc');

      expect(mockUserTopicRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-abc' },
          relations: ['topic'],
        }),
      );
    });
  });

  describe('saveUserTopics', () => {
    it('deletes existing and saves new user topics', async () => {
      const topic = makeTopic('t-1', 'React');
      mockUserTopicRepo.delete.mockResolvedValue({ affected: 2 });
      mockUserTopicRepo.save.mockResolvedValue([]);
      mockUserTopicRepo.find.mockResolvedValue([makeUserTopic('u-1', 't-1', topic)]);

      const result = await service.saveUserTopics('u-1', ['t-1']);

      expect(mockUserTopicRepo.delete).toHaveBeenCalledWith({ userId: 'u-1' });
      expect(mockUserTopicRepo.save).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('returns empty array when topicIds is empty', async () => {
      mockUserTopicRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.saveUserTopics('u-1', []);

      expect(result).toEqual([]);
      expect(mockUserTopicRepo.save).not.toHaveBeenCalled();
    });
  });
});
