/**
 * Вставка уроков из JSON (mock-lesson / офлайн-батч).
 *
 * Использование (из каталога techdaily-back):
 *   DATABASE_URL=postgresql://... npx ts-node -r tsconfig-paths/register scripts/seed-mock-lessons.ts [путь-к-json]
 *
 * По умолчанию путь: ../mock-lesson.json (корень монорепы techdaily).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { normalizeLessonInteractivePayload } from '../src/modules/lessons/lesson-interactive.normalize';
import type { LessonInteractivePayload } from '../src/modules/lessons/lesson-interactive.types';

const KNOWN_SLUGS = new Set([
  'react',
  'typescript',
  'docker',
  'kubernetes',
  'graphql',
  'rust',
  'python',
  'ai-ml',
  'security',
  'devops',
  'system-design',
  'web-apis',
]);

const KNOWN_DIFFICULTY = new Set(['beginner', 'intermediate', 'advanced']);

interface MockLessonJson {
  topic_slug?: string;
  difficulty?: string;
  title?: string;
  summary?: string;
  why_it_matters?: string;
  source_urls?: unknown;
  phases?: unknown;
  flashcards?: unknown;
}

/** Копия логики lessons.service без Nest-зависимостей. */
function concatLessonBodies(
  summary: string,
  payload: LessonInteractivePayload | null | undefined,
): string {
  const s = (summary ?? '').trim();
  if (!payload?.phases?.length) return s || 'Урок без текста.';
  const parts = payload.phases.map((ph, idx) => {
    const cx =
      ph.code_examples?.filter(Boolean).length > 0
        ? ph.code_examples
            .filter(Boolean)
            .map((code) => ['```', code.trim(), '```'].join('\n'))
            .join('\n\n')
        : '';
    return [`### Часть ${idx + 1}`, ph.theory.trim(), cx]
      .filter(Boolean)
      .join('\n\n');
  });
  return [s, ...parts].filter(Boolean).join('\n\n---\n\n');
}

function loadEnvFromFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

function validateAndBuild(
  raw: MockLessonJson,
): { sqlParams: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const slug = String(raw.topic_slug ?? '').trim();
  if (!KNOWN_SLUGS.has(slug)) {
    errors.push(`unknown topic_slug: ${slug}`);
  }
  const diff = String(raw.difficulty ?? 'intermediate').toLowerCase();
  if (!KNOWN_DIFFICULTY.has(diff)) {
    errors.push(`bad difficulty: ${raw.difficulty}`);
  }
  const title = String(raw.title ?? '').trim();
  const summary = String(raw.summary ?? '').trim();
  const why = String(raw.why_it_matters ?? '').trim();
  if (!title) errors.push('empty title');
  if (!summary) errors.push('empty summary');
  if (!why) errors.push('empty why_it_matters');

  const urls = Array.isArray(raw.source_urls)
    ? raw.source_urls.map((u) => String(u).trim()).filter(Boolean)
    : [];
  if (urls.length < 1) errors.push(`source_urls expected at least 1 URL, got ${urls.length}`);

  const phasesRaw = raw.phases;
  const interactive = normalizeLessonInteractivePayload(phasesRaw);
  if (!interactive)
    errors.push('phases invalid (need 3 parts, 5 MCQs each, etc.)');

  const fcRaw = raw.flashcards;
  const flashcards =
    Array.isArray(fcRaw) && fcRaw.length
      ? fcRaw.map((fc) => {
          if (!fc || typeof fc !== 'object') return null;
          const o = fc as { question?: unknown; answer?: unknown };
          const q = String(o.question ?? '').trim();
          const a = String(o.answer ?? '').trim();
          if (!q || !a) return null;
          return { question: q, answer: a };
        })
      : [];
  const flashOk = flashcards.filter(
    (x): x is { question: string; answer: string } => x !== null,
  );
  if (flashOk.length < 4) errors.push(`flashcards need >=4, got ${flashOk.length}`);

  const content =
    interactive && interactive.phases?.length === 3
      ? concatLessonBodies(summary, interactive)
      : summary;

  return {
    errors,
    sqlParams: {
      title,
      content,
      whyItMatters: why,
      topicSlug: slug,
      difficulty: diff,
      sourceUrl: urls[0] ?? null,
      sourceUrls: urls.length ? urls : [],
      interactivePayload:
        interactive && interactive.phases?.length === 3 ? interactive : null,
      flashcardsPayload: flashOk,
      estimatedMinutes: interactive?.phases?.length === 3 ? 35 : 8,
    },
  };
}

async function main(): Promise<void> {
  const cwd = path.join(__dirname, '..');
  loadEnvFromFile(path.join(cwd, '.env'));
  loadEnvFromFile(path.join(__dirname, '../../.env'));

  const jsonPathArg = process.argv[2];
  const jsonPath = path.resolve(
    jsonPathArg || path.join(cwd, '..', 'mock-lesson.json'),
  );
  const rawText = fs.readFileSync(jsonPath, 'utf8').trim();

  let root: { lessons?: MockLessonJson[] };
  try {
    root = JSON.parse(rawText) as { lessons?: MockLessonJson[] };
  } catch (e) {
    console.error('JSON parse failed:', (e as Error).message);
    process.exit(1);
  }

  const toProcess = Array.isArray(root.lessons) ? root.lessons : [];

  if (!toProcess.length) {
    console.error('No lessons[] in JSON');
    process.exit(1);
  }

  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '';
  if (!databaseUrl) {
    console.error(
      'Set DATABASE_URL (e.g. from .env in techdaily-back or repo root).',
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let ok = 0;
  let skipped = 0;

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const lesson = toProcess[i];
      const built = validateAndBuild(lesson);
      if (built.errors.length) {
        console.warn(
          `Skip lesson #${i + 1} "${lesson.title ?? ''}": ${built.errors.join('; ')}`,
        );
        skipped++;
        continue;
      }
      const p = built.sqlParams;
      const tr = await client.query(
        'SELECT id FROM topics WHERE slug = $1 LIMIT 1',
        [p.topicSlug],
      );
      if (!tr.rows[0]?.id) {
        console.warn(`Skip #${i + 1}: topic slug not in DB: ${p.topicSlug}`);
        skipped++;
        continue;
      }
      const topicId = tr.rows[0].id;

      await client.query(
        `
INSERT INTO lessons (
  title,
  content,
  why_it_matters,
  topic_id,
  source_url,
  source_urls,
  difficulty,
  estimated_minutes,
  is_published,
  reviewed_at,
  published_at,
  rejection_reason,
  curated_for_user_id,
  flashcards_payload,
  interactive_payload,
  created_at,
  updated_at
) VALUES (
  $1, $2, $3, $4::uuid, $5, $6::jsonb,
  $7::skill_level_enum, $8, TRUE, NOW(), NOW(),
  NULL, NULL, $9::jsonb, $10::jsonb,
  NOW(), NOW()
)
`,
        [
          p.title,
          p.content,
          p.whyItMatters,
          topicId,
          p.sourceUrl,
          JSON.stringify(p.sourceUrls),
          p.difficulty,
          p.estimatedMinutes,
          JSON.stringify(p.flashcardsPayload),
          p.interactivePayload
            ? JSON.stringify(p.interactivePayload as LessonInteractivePayload)
            : null,
        ],
      );
      ok++;
    }
  } finally {
    await client.end();
  }

  console.log(
    `Done. Inserted ${ok} lessons, skipped ${skipped}. File: ${jsonPath}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
