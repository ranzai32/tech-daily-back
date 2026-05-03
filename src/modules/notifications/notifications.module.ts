import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { User } from '../users/user.entity';
import { NOTIFICATIONS_QUEUE } from './notifications.queue';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsJob } from './notifications.job';
import { NotificationsSchedulerService } from './notifications.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  providers: [NotificationsService, NotificationsJob, NotificationsSchedulerService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
