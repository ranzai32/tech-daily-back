import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { NotificationSubscriptionFrequency } from './dto/subscribe.dto';

export interface NotificationTargetUser {
  userId: string;
  fcmToken: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async subscribe(
    userId: string,
    fcmToken: string,
    frequency: NotificationSubscriptionFrequency,
  ) {
    await this.usersRepository.update(userId, {
      fcmToken,
      notificationFrequency: frequency,
    });
    return { ok: true };
  }

  isFrequencyDue(frequency: string, dayOfWeekUtc: number): boolean {
    if (frequency === 'daily') return true;
    if (frequency === 'weekly') return dayOfWeekUtc === 1; // Monday
    if (frequency === '3x_week') {
      // Monday / Wednesday / Friday
      return dayOfWeekUtc === 1 || dayOfWeekUtc === 3 || dayOfWeekUtc === 5;
    }
    return false;
  }

  async getUsersForNotificationTick(now: Date): Promise<NotificationTargetUser[]> {
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;
    const day = now.getUTCDay();

    const users = await this.usersRepository.find({
      where: { notificationTime: time },
      select: ['id', 'fcmToken', 'notificationFrequency'],
    });

    return users
      .filter((u) => !!u.fcmToken)
      .filter((u) => this.isFrequencyDue(u.notificationFrequency, day))
      .map((u) => ({ userId: u.id, fcmToken: u.fcmToken as string }));
  }

  async sendFcm(token: string, title: string, body: string): Promise<void> {
    // Placeholder transport. Integrate Firebase Admin SDK when ready.
    this.logger.log(
      `FCM send placeholder token=${token.slice(0, 8)}... title=${title} body=${body}`,
    );
  }
}
