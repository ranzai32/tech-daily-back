import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './bookmark.entity';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarkRepository: Repository<Bookmark>,
  ) {}

  async getByUser(userId: string): Promise<Bookmark[]> {
    return this.bookmarkRepository.find({ where: { userId } });
  }

  async add(userId: string, lessonId: string): Promise<Bookmark> {
    const existing = await this.bookmarkRepository.findOne({
      where: { userId, lessonId },
    });
    if (existing) return existing;

    const bookmark = this.bookmarkRepository.create({ userId, lessonId });
    return this.bookmarkRepository.save(bookmark);
  }

  async remove(id: string, userId: string): Promise<void> {
    const bookmark = await this.bookmarkRepository.findOne({
      where: { id, userId },
    });
    if (!bookmark) throw new NotFoundException('Bookmark not found');
    await this.bookmarkRepository.remove(bookmark);
  }
}
