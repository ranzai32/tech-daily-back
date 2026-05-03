import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1746393600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE skill_level_enum AS ENUM ('beginner', 'intermediate', 'advanced')`,
    );

    await queryRunner.query(`
      CREATE TABLE users (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email        VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        skill_level  skill_level_enum NOT NULL DEFAULT 'beginner',
        full_name    VARCHAR(255),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE topics (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) UNIQUE NOT NULL,
        slug        VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        icon_url    VARCHAR(512),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE user_topics (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic_id   UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_topics_user_topic UNIQUE (user_id, topic_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE lessons (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title             VARCHAR(512) NOT NULL,
        content           TEXT NOT NULL,
        why_it_matters    TEXT,
        topic_id          UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        source_url        VARCHAR(2048),
        difficulty        skill_level_enum NOT NULL DEFAULT 'intermediate',
        estimated_minutes INTEGER NOT NULL DEFAULT 5,
        is_published      BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE user_lessons (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        read_at      TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_lessons_user_lesson UNIQUE (user_id, lesson_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE bookmarks (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id  UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_bookmarks_user_lesson UNIQUE (user_id, lesson_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE flashcards (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id      UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        question       TEXT NOT NULL,
        answer         TEXT NOT NULL,
        next_review_at TIMESTAMPTZ,
        interval       INTEGER NOT NULL DEFAULT 1,
        ease_factor    FLOAT NOT NULL DEFAULT 2.5,
        repetitions    INTEGER NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE user_streaks (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        current_streak     INTEGER NOT NULL DEFAULT 0,
        longest_streak     INTEGER NOT NULL DEFAULT 0,
        last_activity_date DATE,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE conversion_signals (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event      VARCHAR(255) NOT NULL,
        metadata   JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_lessons_topic_id ON lessons(topic_id)`);
    await queryRunner.query(`CREATE INDEX idx_lessons_is_published ON lessons(is_published)`);
    await queryRunner.query(`CREATE INDEX idx_flashcards_user_next_review ON flashcards(user_id, next_review_at)`);
    await queryRunner.query(`CREATE INDEX idx_conversion_signals_user_id ON conversion_signals(user_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_conversion_signals_user_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_flashcards_user_next_review`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lessons_is_published`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lessons_topic_id`);

    await queryRunner.query(`DROP TABLE IF EXISTS conversion_signals`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_streaks`);
    await queryRunner.query(`DROP TABLE IF EXISTS flashcards`);
    await queryRunner.query(`DROP TABLE IF EXISTS bookmarks`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_lessons`);
    await queryRunner.query(`DROP TABLE IF EXISTS lessons`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_topics`);
    await queryRunner.query(`DROP TABLE IF EXISTS topics`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);

    await queryRunner.query(`DROP TYPE IF EXISTS skill_level_enum`);
  }
}
