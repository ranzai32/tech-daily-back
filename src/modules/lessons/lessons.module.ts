import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './lesson.entity';
import { UserLesson } from './user-lesson.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { DemoLessonsSeedService } from './demo-lessons.seed.service';
import { TopicsModule } from '../topics/topics.module';
import { StreaksModule } from '../streaks/streaks.module';
import { ConversionModule } from '../conversion/conversion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson, UserLesson]),
    TopicsModule,
    StreaksModule,
    ConversionModule,
  ],
  providers: [LessonsService, DemoLessonsSeedService],
  controllers: [LessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}
