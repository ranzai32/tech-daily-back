import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Topic } from './topic.entity';
import { UserTopic } from './user-topic.entity';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { TopicsSeedService } from './topics.seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Topic, UserTopic])],
  providers: [TopicsService, TopicsSeedService],
  controllers: [TopicsController],
  exports: [TopicsService],
})
export class TopicsModule {}
