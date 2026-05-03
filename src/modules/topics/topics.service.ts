import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic } from './topic.entity';
import { UserTopic } from './user-topic.entity';

@Injectable()
export class TopicsService {
  constructor(
    @InjectRepository(Topic)
    private readonly topicRepository: Repository<Topic>,
    @InjectRepository(UserTopic)
    private readonly userTopicRepository: Repository<UserTopic>,
  ) {}

  async findAll(): Promise<Topic[]> {
    return this.topicRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Topic> {
    const topic = await this.topicRepository.findOne({ where: { id } });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  async getUserTopics(userId: string): Promise<Topic[]> {
    const userTopics = await this.userTopicRepository.find({
      where: { userId },
      relations: ['topic'],
      order: { createdAt: 'ASC' },
    });
    return userTopics.map((ut) => ut.topic);
  }

  async saveUserTopics(userId: string, topicIds: string[]): Promise<Topic[]> {
    await this.userTopicRepository.delete({ userId });
    if (topicIds.length === 0) return [];
    const entities = topicIds.map((topicId) =>
      this.userTopicRepository.create({ userId, topicId }),
    );
    await this.userTopicRepository.save(entities);
    return this.getUserTopics(userId);
  }

  async create(name: string, description?: string): Promise<Topic> {
    const slug = name.toLowerCase().replace(/[\s/]+/g, '-');
    const topic = this.topicRepository.create({ name, slug, description });
    return this.topicRepository.save(topic);
  }
}
