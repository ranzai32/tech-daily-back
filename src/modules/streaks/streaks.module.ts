import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStreak } from './streak.entity';
import { UserLesson } from '../lessons/user-lesson.entity';
import { StreaksService } from './streaks.service';
import { StreaksController } from './streaks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserStreak, UserLesson])],
  providers: [StreaksService],
  controllers: [StreaksController],
  exports: [StreaksService],
})
export class StreaksModule {}
