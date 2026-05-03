import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonReviewDraft1746395000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE lessons
        ADD COLUMN reviewed_at TIMESTAMPTZ,
        ADD COLUMN published_at TIMESTAMPTZ,
        ADD COLUMN rejection_reason TEXT,
        ADD COLUMN curated_for_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN flashcards_payload JSONB
    `);
    await queryRunner.query(`
      UPDATE lessons SET reviewed_at = created_at WHERE reviewed_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE lessons SET published_at = created_at WHERE is_published = true AND published_at IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX idx_lessons_reviewed_at ON lessons(reviewed_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lessons_reviewed_at`);
    await queryRunner.query(`
      ALTER TABLE lessons
        DROP COLUMN IF EXISTS flashcards_payload,
        DROP COLUMN IF EXISTS curated_for_user_id,
        DROP COLUMN IF EXISTS rejection_reason,
        DROP COLUMN IF EXISTS published_at,
        DROP COLUMN IF EXISTS reviewed_at
    `);
  }
}
