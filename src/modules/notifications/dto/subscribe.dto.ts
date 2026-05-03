import { IsEnum, IsString, MaxLength } from 'class-validator';

export enum NotificationSubscriptionFrequency {
  Daily = 'daily',
  ThreePerWeek = '3x_week',
  Weekly = 'weekly',
}

export class SubscribeNotificationsDto {
  @IsString()
  @MaxLength(1024)
  fcm_token: string;

  @IsEnum(NotificationSubscriptionFrequency)
  frequency: NotificationSubscriptionFrequency;
}
