import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserLesson } from '../lessons/user-lesson.entity';
import { Lesson } from '../lessons/lesson.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TopicsModule } from '../topics/topics.module';
import { StreaksModule } from '../streaks/streaks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserLesson, Lesson]),
    TopicsModule,
    StreaksModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
