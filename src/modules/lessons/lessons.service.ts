import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from './lesson.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  async findAll(pagination: PaginationDto): Promise<[Lesson[], number]> {
    const { page, limit } = pagination;
    return this.lessonRepository.findAndCount({
      where: { isPublished: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async findByTopic(topicId: string): Promise<Lesson[]> {
    return this.lessonRepository.find({
      where: { topicId, isPublished: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(data: Partial<Lesson>): Promise<Lesson> {
    const lesson = this.lessonRepository.create(data);
    return this.lessonRepository.save(lesson);
  }
}
