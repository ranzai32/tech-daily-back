import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic } from './topic.entity';

interface SeedTopic {
  name: string;
  slug: string;
  description: string;
}

const SEED_TOPICS: SeedTopic[] = [
  { name: 'React', slug: 'react', description: 'Component-based UI library' },
  { name: 'TypeScript', slug: 'typescript', description: 'Typed JavaScript superset' },
  { name: 'Docker', slug: 'docker', description: 'Containerization platform' },
  { name: 'Kubernetes', slug: 'kubernetes', description: 'Container orchestration' },
  { name: 'GraphQL', slug: 'graphql', description: 'Query language for APIs' },
  { name: 'Rust', slug: 'rust', description: 'Systems programming language' },
  { name: 'Python', slug: 'python', description: 'Versatile scripting language' },
  { name: 'AI/ML', slug: 'ai-ml', description: 'Artificial intelligence and machine learning' },
  { name: 'Security', slug: 'security', description: 'Application and network security' },
  { name: 'DevOps', slug: 'devops', description: 'Development and operations practices' },
  { name: 'System Design', slug: 'system-design', description: 'Architecture and scalability' },
  { name: 'Web APIs', slug: 'web-apis', description: 'REST, gRPC, and API design' },
];

@Injectable()
export class TopicsSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Topic)
    private readonly topicRepository: Repository<Topic>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.topicRepository.count();
    if (count > 0) return;
    await this.topicRepository.save(
      SEED_TOPICS.map((t) => this.topicRepository.create(t)),
    );
  }
}
