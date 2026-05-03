import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SkillLevel } from '../../common/enums/skill-level.enum';

export type NotificationFrequency = 'off' | 'daily' | '3x_week' | 'weekly';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'email', unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({
    name: 'skill_level',
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.Beginner,
  })
  skillLevel: SkillLevel;

  @Column({ name: 'full_name', length: 255, nullable: true })
  fullName: string | null;

  @Column({ name: 'notification_frequency', length: 16, default: 'daily' })
  notificationFrequency: NotificationFrequency;

  @Column({ name: 'notification_time', length: 5, default: '09:00' })
  notificationTime: string;

  @Column({ name: 'streak_visible', default: true })
  streakVisible: boolean;

  @Column({ name: 'fcm_token', length: 1024, nullable: true })
  fcmToken: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
