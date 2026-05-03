import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './bookmark.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface BookmarkListItem {
  id: string;
  lesson_id: string;
  created_at: Date;
  lesson: { id: string; title: string } | null;
}

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarkRepository: Repository<Bookmark>,
  ) {}

  async findPage(userId: string, pagination: PaginationDto): Promise<{
    items: BookmarkListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = pagination;
    const [rows, total] = await this.bookmarkRepository.findAndCount({
      where: { userId },
      relations: ['lesson'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items: BookmarkListItem[] = rows.map((b) => ({
      id: b.id,
      lesson_id: b.lessonId,
      created_at: b.createdAt,
      lesson: b.lesson
        ? { id: b.lesson.id, title: b.lesson.title }
        : null,
    }));

    return { items, total, page, limit };
  }

  async add(userId: string, lessonId: string): Promise<Bookmark> {
    const existing = await this.bookmarkRepository.findOne({
      where: { userId, lessonId },
    });
    if (existing) return existing;

    const bookmark = this.bookmarkRepository.create({ userId, lessonId });
    return this.bookmarkRepository.save(bookmark);
  }

  async removeByLesson(userId: string, lessonId: string): Promise<void> {
    const result = await this.bookmarkRepository.delete({ userId, lessonId });
    if (!result.affected) {
      throw new NotFoundException('Bookmark not found');
    }
  }

  async removeById(userId: string, id: string): Promise<void> {
    const result = await this.bookmarkRepository.delete({ userId, id });
    if (!result.affected) {
      throw new NotFoundException('Bookmark not found');
    }
  }

  async removeByIdOrLesson(userId: string, value: string): Promise<void> {
    const byId = await this.bookmarkRepository.delete({ userId, id: value });
    if (byId.affected) return;
    const byLesson = await this.bookmarkRepository.delete({ userId, lessonId: value });
    if (byLesson.affected) return;
    throw new NotFoundException('Bookmark not found');
  }
}
