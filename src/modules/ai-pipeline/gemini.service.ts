import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
} from '@google/generative-ai';
import { normalizeLessonInteractivePayload } from '../lessons/lesson-interactive.normalize';
import type { LessonPhase } from '../lessons/lesson-interactive.types';
import {
  buildLessonPromptChunk1,
  buildLessonPromptChunk2,
  buildLessonPromptChunk3,
  excerptForChainedPrompt,
} from '../../ai-pipeline/prompts/lesson-chained.prompt';

export interface CuratedLesson {
  title: string;
  content: string;
  whyItMatters: string;
  difficulty: 'beginner' | 'medium' | 'advanced';
  estimatedMinutes: number;
  tags: string[];
}

export interface GeneratedFlashcard {
  question: string;
  answer: string;
}

export interface GeminiDailyLessonDraft {
  title: string;
  summary: string;
  why_it_matters: string;
  source_urls: string[];
  flashcards: { question: string; answer: string }[];
  /** Три фазы (теория+тест); опционально если модель вернула некорректный JSON */
  phases?: LessonPhase[];
}

/** Аргументы для пошаговой генерации дневного урока (3 промта). */
export interface GenerateDailyLessonArgs {
  itemsJson: string;
  skillLevel: string;
  topic: string;
  userProgressSnippet: string;
}

export interface GeminiCallLog {
  operation: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Без пробелов/переносов из .env (частый источник 401). */
function normalizeApiKey(raw: string | undefined): string {
  return (raw ?? '').trim();
}

/** Если GEMINI_MODEL не задан — актуальный Flash в API Google AI. */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Алиас «текущего» Flash: Google перенаправляет на поддерживаемую модель (линия 3.x).
 * Запасной эндпоинт при перегрузке конкретной версии 2.5.
 */
const FLASH_LATEST_ALIAS = 'gemini-flash-latest';

function resolveModelName(): string {
  const m = (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
  return m || DEFAULT_GEMINI_MODEL;
}

/** Не совпадает с primary; иначе null (fallback нечего вызывать). */
function resolveFallbackDailyLessonModel(primary: string): string | null {
  const fromEnv = (process.env.GEMINI_FALLBACK_MODEL ?? '').trim();
  if (fromEnv && fromEnv !== primary) return fromEnv;
  const pool = [
    FLASH_LATEST_ALIAS,
    DEFAULT_GEMINI_MODEL,
    'gemini-3.1-flash-lite-preview',
  ];
  const pick = pool.find((m) => m !== primary);
  return pick ?? null;
}

function extractApiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err)
    return String((err as { message?: string }).message);
  return String(err);
}

function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/** Первый сбалансированный объект или массив (модели 2.x иногда дописывают текст после JSON). */
function extractFirstBalancedJsonSlice(
  s: string,
  open: '{' | '[',
  close: '}' | ']',
): string | null {
  const start = s.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Разбирать JSON от LLM: fences, затем первый объект/массив без «хвоста» после JSON. */
function parseJsonStrict<T>(raw: string): T {
  const cleaned = stripCodeFences(raw);
  const trimmed = cleaned.trim();
  let firstErr: unknown;
  try {
    return JSON.parse(trimmed) as T;
  } catch (e) {
    firstErr = e;
  }

  const iObj = trimmed.indexOf('{');
  const iArr = trimmed.indexOf('[');
  const preferArray =
    iArr !== -1 && (iObj === -1 || iArr < iObj);

  const tryParse = (slice: string | null): T | undefined => {
    if (slice === null) return undefined;
    try {
      return JSON.parse(slice) as T;
    } catch {
      return undefined;
    }
  };

  if (preferArray) {
    const v = tryParse(
      extractFirstBalancedJsonSlice(trimmed, '[', ']'),
    );
    if (v !== undefined) return v;
  } else if (iObj !== -1) {
    const v = tryParse(
      extractFirstBalancedJsonSlice(trimmed, '{', '}'),
    );
    if (v !== undefined) return v;
  }

  const fallbackObj = tryParse(
    extractFirstBalancedJsonSlice(trimmed, '{', '}'),
  );
  if (fallbackObj !== undefined) return fallbackObj;
  const fallbackArr = tryParse(
    extractFirstBalancedJsonSlice(trimmed, '[', ']'),
  );
  if (fallbackArr !== undefined) return fallbackArr;

  if (firstErr instanceof Error) throw firstErr;
  throw new Error(String(firstErr));
}

export interface GeminiPingResult {
  ok: boolean;
  model: string;
  latencyMs?: number;
  /** Для успеха или короткого описания ошибки для UI */
  message: string;
  /** Сырой текст ответа/ошибки (для отладки) */
  detail?: string;
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model!: GenerativeModel;
  private flashcardModel!: GenerativeModel;

  onModuleInit() {
    const key = normalizeApiKey(process.env.GEMINI_API_KEY);
    if (!key) {
      this.logger.warn('GEMINI_API_KEY not set; Gemini calls will fail');
      return;
    }
    process.env.GEMINI_API_KEY = key;
    this.genAI = new GoogleGenerativeAI(key);
    const modelName = resolveModelName();
    this.logger.log(`Gemini client init model=${modelName}`);

    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            content: { type: SchemaType.STRING },
            whyItMatters: { type: SchemaType.STRING },
            difficulty: { type: SchemaType.STRING },
            estimatedMinutes: { type: SchemaType.NUMBER },
            tags: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
          },
          required: [
            'title',
            'content',
            'whyItMatters',
            'difficulty',
            'estimatedMinutes',
            'tags',
          ],
        },
      },
    });

    this.flashcardModel = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question: { type: SchemaType.STRING },
              answer: { type: SchemaType.STRING },
            },
            required: ['question', 'answer'],
          },
        },
      },
    });
  }

  private logGeminiCall(
    operation: string,
    started: number,
    result: { response: { usageMetadata?: unknown } },
  ): void {
    const latencyMs = Date.now() - started;
    const u = (result.response.usageMetadata || {}) as Record<
      string,
      number | undefined
    >;
    const promptTokens = Number(u.promptTokenCount ?? u.prompt_tokens ?? 0);
    const completionTokens = Number(
      u.candidatesTokenCount ?? u.completion_tokens ?? 0,
    );
    const totalTokens = Number(u.totalTokenCount ?? u.total_tokens ?? 0);
    this.logger.log(
      `Gemini ${operation} latency=${latencyMs}ms promptTokens=${promptTokens} completionTokens=${completionTokens} totalTokens=${totalTokens}`,
    );
  }

  /**
   * Минимальный запрос — проверить ключ, модель и сеть с бэкенда.
   */
  async ping(): Promise<GeminiPingResult> {
    const modelName = resolveModelName();
    if (!this.genAI) {
      return {
        ok: false,
        model: modelName,
        message: 'GEMINI_API_KEY не задан или пустой после trim()',
      };
    }
    const started = Date.now();
    try {
      const m = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const result = await m.generateContent(
        'Reply with JSON only, no markdown: {"ping":true}',
      );
      const text = result.response.text();
      if (!text?.trim()) {
        const finish = result.response.candidates?.[0]?.finishReason;
        return {
          ok: false,
          model: modelName,
          latencyMs: Date.now() - started,
          message: 'Пустой ответ от Gemini',
          detail: finish ? `finishReason=${finish}` : undefined,
        };
      }
      const parsed = parseJsonStrict<{ ping?: boolean }>(text);
      const ok = parsed?.ping === true;
      return {
        ok,
        model: modelName,
        latencyMs: Date.now() - started,
        message: ok
          ? 'Gemini отвечает, ключ и модель рабочие'
          : 'Ответ не JSON {ping:true}',
        detail: ok ? undefined : text.slice(0, 500),
      };
    } catch (err) {
      const msg = extractApiErrorMessage(err);
      this.logger.error(`Gemini ping failed: ${msg}`, err as Error);
      return {
        ok: false,
        model: modelName,
        latencyMs: Date.now() - started,
        message: msg,
        detail: extractApiErrorMessage(err),
      };
    }
  }

  async curateFromUrl(url: string, topicName: string): Promise<CuratedLesson> {
    const prompt = `
Ты — редактор технического образовательного контента.
Создай обучающий урок на русском языке на основе этой ссылки: ${url}
Тема: ${topicName}

Урок должен быть ёмким, практичным и понятным разработчику middle-уровня.
Поле "content" — основная часть урока (минимум 200 слов).
Поле "whyItMatters" — 2-3 предложения, почему это важно знать на практике.
Поле "difficulty" — одно из: beginner, medium, advanced.
Поле "estimatedMinutes" — сколько минут займёт прочтение (целое число).
Поле "tags" — 3-5 ключевых тегов на английском.
    `.trim();

    this.logger.log(`Curating content from: ${url}`);
    const started = Date.now();
    const result = await this.model.generateContent(prompt);
    this.logGeminiCall('curateFromUrl', started, result);
    return parseJsonStrict<CuratedLesson>(result.response.text());
  }

  async curateFromText(text: string, topicName: string): Promise<CuratedLesson> {
    const prompt = `
Ты — редактор технического образовательного контента.
Создай обучающий урок на русском языке на основе следующего текста.
Тема: ${topicName}

Текст:
${text}

Поле "content" — основная часть урока (минимум 200 слов).
Поле "whyItMatters" — 2-3 предложения, почему это важно знать на практике.
Поле "difficulty" — одно из: beginner, medium, advanced.
Поле "estimatedMinutes" — сколько минут займёт прочтение (целое число).
Поле "tags" — 3-5 ключевых тегов на английском.
    `.trim();

    const started = Date.now();
    const result = await this.model.generateContent(prompt);
    this.logGeminiCall('curateFromText', started, result);
    return parseJsonStrict<CuratedLesson>(result.response.text());
  }

  async generateFlashcards(
    lessonContent: string,
    count = 5,
  ): Promise<GeneratedFlashcard[]> {
    const prompt = `
Создай ${count} флэш-карточек для повторения по следующему уроку.
Вопросы и ответы должны быть на русском языке, конкретными и проверяемыми.

Урок:
${lessonContent}
    `.trim();

    const started = Date.now();
    const result = await this.flashcardModel.generateContent(prompt);
    this.logGeminiCall('generateFlashcards', started, result);
    return parseJsonStrict<GeneratedFlashcard[]>(result.response.text());
  }

  private modelNotFound(err: unknown): boolean {
    const s = extractApiErrorMessage(err).toLowerCase();
    return (
      s.includes('not found') ||
      s.includes('404') ||
      s.includes('invalid model') ||
      s.includes('does not exist') ||
      s.includes('unknown model')
    );
  }

  /** Перегрузка capacity / rate limit у Google — имеет смысл повторить или сменить модель. */
  private transientGeminiFailure(err: unknown): boolean {
    const s = extractApiErrorMessage(err).toLowerCase();
    return (
      s.includes('503') ||
      s.includes('429') ||
      s.includes('service unavailable') ||
      s.includes('high demand') ||
      s.includes('resource exhausted') ||
      s.includes('overload') ||
      s.includes('unavailable') ||
      s.includes('too many requests') ||
      s.includes('try again')
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  private resolveLessonStepDelayMs(): number {
    const n = Number(process.env.GEMINI_LESSON_STEP_DELAY_MS);
    return Number.isFinite(n) && n >= 0 ? n : 2500;
  }

  private rawPhaseFromLessonChunk(
    parsed: Record<string, unknown>,
  ): { theory: string; code_examples: string[]; quiz: unknown[] } {
    if (
      Array.isArray(parsed.phases) &&
      parsed.phases[0] &&
      typeof parsed.phases[0] === 'object'
    ) {
      const p = parsed.phases[0] as Record<string, unknown>;
      return {
        theory: String(p.theory ?? ''),
        code_examples: Array.isArray(p.code_examples)
          ? p.code_examples.map(String)
          : [],
        quiz: Array.isArray(p.quiz) ? p.quiz : [],
      };
    }
    return {
      theory: String(parsed.theory ?? ''),
      code_examples: Array.isArray(parsed.code_examples)
        ? parsed.code_examples.map(String)
        : [],
      quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
    };
  }

  private async generateLessonJsonChunk(
    modelName: string,
    prompt: string,
    logLabel: string,
  ): Promise<Record<string, unknown>> {
    const m = this.genAI!.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 6144,
        responseMimeType: 'application/json',
      },
    });
    const started = Date.now();
    const result = await m.generateContent(prompt);
    this.logGeminiCall(`${logLabel}(${modelName})`, started, result);
    const text = result.response.text();
    if (!text?.trim()) {
      const fr = result.response.candidates?.[0]?.finishReason;
      throw new Error(
        `${logLabel}: Gemini returned empty text (finishReason=${fr ?? 'undefined'})`,
      );
    }
    return parseJsonStrict<Record<string, unknown>>(text);
  }

  private async lessonChunkWithBackoff(
    modelName: string,
    prompt: string,
    logLabel: string,
  ): Promise<Record<string, unknown>> {
    const backoffs = [0, 900, 2200];
    let lastErr: unknown;
    for (let i = 0; i < backoffs.length; i++) {
      if (backoffs[i] > 0) await this.delay(backoffs[i]);
      try {
        return await this.generateLessonJsonChunk(
          modelName,
          prompt,
          logLabel,
        );
      } catch (e) {
        lastErr = e;
        const canRetry =
          i < backoffs.length - 1 && this.transientGeminiFailure(e);
        if (canRetry) {
          this.logger.warn(
            `Gemini transient error ${logLabel} model=${modelName} retry ${i + 2}/${backoffs.length}: ${extractApiErrorMessage(e)}`,
          );
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }

  /** Три последовательных запроса с паузой; при падении любого шага — исключение (урок в БД не пишем). */
  private async runDailyLessonChain(
    modelName: string,
    args: GenerateDailyLessonArgs,
  ): Promise<GeminiDailyLessonDraft> {
    const stepDelay = this.resolveLessonStepDelayMs();
    const p1 = buildLessonPromptChunk1(
      args.itemsJson,
      args.skillLevel,
      args.topic,
      args.userProgressSnippet,
    );
    const j1 = await this.lessonChunkWithBackoff(modelName, p1, 'lessonChunk1');
    const title = String(j1.title ?? '').trim();
    const summary = String(j1.summary ?? '').trim();
    const why = String(j1.why_it_matters ?? j1['whyItMatters'] ?? '').trim();
    const sourceUrls = Array.isArray(j1.source_urls)
      ? j1.source_urls.map((u) => String(u).trim()).filter(Boolean)
      : [];
    if (!title || !summary) {
      throw new Error('lessonChunk1: missing title or summary');
    }

    const phase1Raw = this.rawPhaseFromLessonChunk(j1);
    await this.delay(stepDelay);

    const p2 = buildLessonPromptChunk2(
      args.skillLevel,
      args.topic,
      title,
      summary,
      excerptForChainedPrompt(phase1Raw.theory),
    );
    const j2 = await this.lessonChunkWithBackoff(modelName, p2, 'lessonChunk2');
    const phase2Raw = this.rawPhaseFromLessonChunk(j2);
    await this.delay(stepDelay);

    const p3 = buildLessonPromptChunk3(
      args.skillLevel,
      args.topic,
      title,
      summary,
      excerptForChainedPrompt(phase1Raw.theory),
      excerptForChainedPrompt(phase2Raw.theory),
    );
    const j3 = await this.lessonChunkWithBackoff(modelName, p3, 'lessonChunk3');
    const phase3Raw = this.rawPhaseFromLessonChunk(j3);
    const flashRaw = Array.isArray(j3.flashcards) ? j3.flashcards : [];
    const flashcards = flashRaw
      .map((fc) =>
        fc && typeof fc === 'object'
          ? {
              question: String((fc as { question?: unknown }).question ?? ''),
              answer: String((fc as { answer?: unknown }).answer ?? ''),
            }
          : { question: '', answer: '' },
      )
      .filter((fc) => fc.question.trim().length && fc.answer.trim().length);

    const phasesTriple = [
      {
        theory: phase1Raw.theory,
        code_examples: phase1Raw.code_examples,
        quiz: phase1Raw.quiz,
      },
      {
        theory: phase2Raw.theory,
        code_examples: phase2Raw.code_examples,
        quiz: phase2Raw.quiz,
      },
      {
        theory: phase3Raw.theory,
        code_examples: phase3Raw.code_examples,
        quiz: phase3Raw.quiz,
      },
    ];
    const interactive = normalizeLessonInteractivePayload(phasesTriple);
    if (!interactive) {
      throw new Error(
        'Chained daily lesson failed validation (phases/quiz/normalize)',
      );
    }
    if (flashcards.length < 4) {
      throw new Error(
        `Chained daily lesson: need at least 4 flashcards, got ${flashcards.length}`,
      );
    }

    return {
      title,
      summary,
      why_it_matters: why,
      source_urls: sourceUrls,
      flashcards,
      phases: interactive.phases,
    };
  }

  /**
   * Генерация дневного урока тремя последовательными промптами (меньший ответ за раз —
   * ниже шанс 503/обрыва). Пауза GEMINI_LESSON_STEP_DELAY_MS (мс, по умолчанию 2500) между шагами.
   * Любой сбой на шаге — полный отказ без частичного урока.
   */
  async generateDailyLesson(
    args: GenerateDailyLessonArgs,
  ): Promise<GeminiDailyLessonDraft> {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    const primaryModel = resolveModelName();
    const fallbackModel = resolveFallbackDailyLessonModel(primaryModel);

    const runOn = (modelName: string) =>
      this.runDailyLessonChain(modelName, args);

    try {
      return await runOn(primaryModel);
    } catch (err) {
      const msg = extractApiErrorMessage(err);
      this.logger.warn(`generateDailyLesson failed on model=${primaryModel}: ${msg}`);
      const tryFallback =
        fallbackModel !== null &&
        (this.modelNotFound(err) || this.transientGeminiFailure(err));
      if (tryFallback) {
        this.logger.warn(
          `Retrying chained daily lesson on fallback model=${fallbackModel}`,
        );
        try {
          return await runOn(fallbackModel);
        } catch (err2) {
          this.logger.error(
            `Chained generateDailyLesson failed on fallback`,
            err2 as Error,
          );
          throw err2;
        }
      }
      this.logger.error(`generateDailyLesson failed`, err as Error);
      throw err;
    }
  }
}
