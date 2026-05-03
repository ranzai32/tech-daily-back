import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './bookmark.entity';
import { BookmarksService } from './bookmarks.service';

describe('BookmarksService', () => {
  let service: BookmarksService;
  let repo: jest.Mocked<
    Pick<
      Repository<Bookmark>,
      | 'findAndCount'
      | 'findOne'
      | 'create'
      | 'save'
      | 'delete'
    >
  >;

  const userId = 'u-1';
  const lessonId = 'l-1';

  beforeEach(async () => {
    repo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarksService,
        { provide: getRepositoryToken(Bookmark), useValue: repo },
      ],
    }).compile();

    service = module.get(BookmarksService);
  });

  describe('findPage', () => {
    it('returns paginated items with snake_case keys', async () => {
      const lesson = { id: lessonId, title: 'T1' } as never;
      const row = {
        id: 'b-1',
        userId,
        lessonId,
        lesson,
        createdAt: new Date('2026-05-01'),
      } as unknown as Bookmark;

      repo.findAndCount.mockResolvedValue([[row], 1]);

      const out = await service.findPage(userId, {
        page: 1,
        limit: 10,
      });

      expect(out.total).toBe(1);
      expect(out.page).toBe(1);
      expect(out.limit).toBe(10);
      expect(out.items).toHaveLength(1);
      expect(out.items[0]).toEqual({
        id: 'b-1',
        lesson_id: lessonId,
        created_at: row.createdAt,
        lesson: { id: lessonId, title: 'T1' },
      });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        relations: ['lesson'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('add', () => {
    it('returns existing bookmark when duplicate', async () => {
      const existing = { id: 'b-x', userId, lessonId } as unknown as Bookmark;
      repo.findOne.mockResolvedValue(existing);

      const out = await service.add(userId, lessonId);

      expect(out).toBe(existing);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates bookmark when new', async () => {
      repo.findOne.mockResolvedValue(null);
      const created = { userId, lessonId } as unknown as Bookmark;
      const saved = { ...created, id: 'b-new' } as unknown as Bookmark;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(saved);

      const out = await service.add(userId, lessonId);

      expect(repo.create).toHaveBeenCalledWith({ userId, lessonId });
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(out).toBe(saved);
    });
  });

  describe('removeByLesson', () => {
    it('throws when no bookmark', async () => {
      repo.delete.mockResolvedValue({ affected: 0, raw: [] });
      await expect(service.removeByLesson(userId, lessonId)).rejects.toThrow(
        'Bookmark not found',
      );
    });

    it('deletes when bookmark exists', async () => {
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });
      await expect(
        service.removeByLesson(userId, lessonId),
      ).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith({ userId, lessonId });
    });
  });
});
