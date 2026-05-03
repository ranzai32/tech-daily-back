import { Client } from 'pg';

/**
 * Jest e2e runs with synchronize disabled (avoids Postgres enum sync bugs).
 * Dev DBs created via synchronize may lack columns added only in migrations —
 * apply the same idempotent DDL as migration 1746396000000 before tests.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('e2e-global-setup: DATABASE_URL not set, skipping schema patch');
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS source_urls JSONB
    `);
    await client.query(`
      UPDATE lessons
      SET source_urls = CASE
        WHEN source_url IS NOT NULL THEN jsonb_build_array(source_url)
        ELSE '[]'::jsonb
      END
      WHERE source_urls IS NULL
    `);
    await client.query(`
      ALTER TABLE user_streaks
        ADD COLUMN IF NOT EXISTS grace_used_on_date DATE
    `);
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS notification_frequency VARCHAR(16) NOT NULL DEFAULT 'daily',
        ADD COLUMN IF NOT EXISTS notification_time VARCHAR(5) NOT NULL DEFAULT '09:00',
        ADD COLUMN IF NOT EXISTS streak_visible BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(1024)
    `);
  } finally {
    await client.end();
  }
}
