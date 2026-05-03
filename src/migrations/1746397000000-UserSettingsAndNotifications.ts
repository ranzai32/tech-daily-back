import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSettingsAndNotifications1746397000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS notification_frequency VARCHAR(16) NOT NULL DEFAULT 'daily',
        ADD COLUMN IF NOT EXISTS notification_time VARCHAR(5) NOT NULL DEFAULT '09:00',
        ADD COLUMN IF NOT EXISTS streak_visible BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(1024)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS fcm_token,
        DROP COLUMN IF EXISTS streak_visible,
        DROP COLUMN IF EXISTS notification_time,
        DROP COLUMN IF EXISTS notification_frequency
    `);
  }
}
