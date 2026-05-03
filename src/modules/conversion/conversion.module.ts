import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversionSignal } from './conversion-signal.entity';
import { ConversionService } from './conversion.service';
import { ConversionController } from './conversion.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { User } from '../users/user.entity';
import { UserStreak } from '../streaks/streak.entity';
import { UserLesson } from '../lessons/user-lesson.entity';
import { Bookmark } from '../bookmarks/bookmark.entity';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversionSignal,
      User,
      UserStreak,
      UserLesson,
      Bookmark,
    ]),
  ],
  providers: [ConversionService, AdminGuard],
  controllers: [ConversionController, AdminAnalyticsController],
  exports: [ConversionService],
})
export class ConversionModule {}
