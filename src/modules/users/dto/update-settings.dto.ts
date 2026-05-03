import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { SkillLevel } from '../../../common/enums/skill-level.enum';
import { NotificationFrequency } from '../user.entity';

enum NotificationFrequencyDto {
  Off = 'off',
  Daily = 'daily',
  ThreePerWeek = '3x_week',
  Weekly = 'weekly',
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(NotificationFrequencyDto)
  notification_frequency?: NotificationFrequency;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  notification_time?: string;

  @IsOptional()
  @IsBoolean()
  streak_visible?: boolean;

  @IsOptional()
  @IsEnum(SkillLevel)
  skill_level?: SkillLevel;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  topic_ids?: string[];
}
