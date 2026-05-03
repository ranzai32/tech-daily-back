import { MigrationInterface, QueryRunner } from 'typeorm';
import { buildRichDemoLessonBody } from '../modules/lessons/demo-lesson-body';

export class EnrichDemoLessonBodies1746397100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: string; topic_name: string }> =
      await queryRunner.query(`
        SELECT l.id AS id, t.name AS topic_name
        FROM lessons l
        INNER JOIN topics t ON t.id = l.topic_id
        WHERE l.title LIKE '%: первый шаг'
      `);
    for (const row of rows) {
      await queryRunner.query(
        `
        UPDATE lessons
        SET
          content = $1,
          estimated_minutes = GREATEST(estimated_minutes, 10)
        WHERE id = $2
      `,
        [buildRichDemoLessonBody(row.topic_name), row.id],
      );
    }
  }

  async down(): Promise<void> {
    /* Irreversible text enrichment */
  }
}
