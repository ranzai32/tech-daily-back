import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonInteractivePayload1746397200000
  implements MigrationInterface
{
  name = 'LessonInteractivePayload1746397200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "interactive_payload" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons" DROP COLUMN IF EXISTS "interactive_payload"
    `);
  }
}
