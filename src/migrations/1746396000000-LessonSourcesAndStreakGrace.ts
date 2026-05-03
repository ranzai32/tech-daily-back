import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonSourcesAndStreakGrace1746396000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS source_urls JSONB
    `);
    await queryRunner.query(`
      UPDATE lessons
      SET source_urls = CASE
        WHEN source_url IS NOT NULL THEN jsonb_build_array(source_url)
        ELSE '[]'::jsonb
      END
      WHERE source_urls IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE user_streaks
        ADD COLUMN IF NOT EXISTS grace_used_on_date DATE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_streaks DROP COLUMN IF EXISTS grace_used_on_date
    `);
    await queryRunner.query(`
      ALTER TABLE lessons DROP COLUMN IF EXISTS source_urls
    `);
  }
}
