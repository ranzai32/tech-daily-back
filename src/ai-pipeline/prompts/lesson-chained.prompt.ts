/** Три последовательных JSON-ответа вместо одного большого (меньше 503 / обрывов). */

export function buildLessonPromptChunk1(
  items: string,
  skillLevel: string,
  topic: string,
  userProgressContext: string,
): string {
  const ctx =
    userProgressContext.trim() ||
    'Отдельного отчёта о пройденном нет — дай понятную базовую дорожку по теме.';
  return `Ты — редактор платформы TechDaily. Спроектируй ПЕРВУЮ ТРЕТЬ интерактивного урока на русском.

Контекст прогресса пользователя:
${ctx}

Раздел новостей/ссылок (фактура):
${items}

Тема дорожки: ${topic}
Уровень в профиле: ${skillLevel}

Задача этой части (фаза 1 из 3):
- theory: несколько связных абзацев — только материал первой трети темы (введение, база), без фаз 2 и 3.
- code_examples: минимум одна строка-код; в первой строке комментарий с языком (например // TypeScript).
- quiz: ровно 5 вопросов; у каждого 4 варианта (strings) и correct_index 0..3.
- title, summary (одно предложение), why_it_matters, source_urls (1–6 URL из входных данных).

ВЕРНИ ОДИН JSON-объект, без markdown и без текста вокруг:
{
  "title": "...",
  "summary": "...",
  "why_it_matters": "...",
  "source_urls": ["..."],
  "theory": "...",
  "code_examples": ["..."],
  "quiz": [
    {"question":"...","choices":["","","",""],"correct_index":0}
  ]
}
В quiz ровно 5 элементов.`.trim();
}

export function buildLessonPromptChunk2(
  skillLevel: string,
  topic: string,
  title: string,
  summary: string,
  phase1TheoryExcerpt: string,
): string {
  return `Ты — редактор TechDaily. Продолжи тот же урок на русском (фаза 2 из 3).

Тема: ${topic}
Уровень: ${skillLevel}
Заголовок урока: ${title}
Краткое резюме: ${summary}

Конец теории фазы 1 (для преемственности, не повторяй дословно):
${phase1TheoryExcerpt}

Задача: theory + code_examples + quiz для ВТОРОЙ трети темы (углубление после фазы 1). Без дублирования фазы 1.
- code_examples: минимум одна строка, первая строка — комментарий с языком.
- quiz: ровно 5 вопросов, по 4 варианта, correct_index 0..3.

ВЕРНИ ОДИН JSON-объект:
{
  "theory": "...",
  "code_examples": ["..."],
  "quiz": [
    {"question":"...","choices":["","","",""],"correct_index":0}
  ]
}`.trim();
}

export function buildLessonPromptChunk3(
  skillLevel: string,
  topic: string,
  title: string,
  summary: string,
  phase1Excerpt: string,
  phase2Excerpt: string,
): string {
  return `Ты — редактор TechDaily. Заверши урок на русском (фаза 3 из 3 + карточки).

Тема: ${topic}
Уровень: ${skillLevel}
Заголовок: ${title}
Резюме: ${summary}

Фрагмент фазы 1 (контекст):
${phase1Excerpt}

Фрагмент фазы 2 (контекст):
${phase2Excerpt}

Задача: theory + code_examples + quiz для ТРЕТЬЕЙ трети (завершение, практика, типичные ошибки). Затем flashcards.
- flashcards: минимум 5 пар question/answer на русском.
- quiz: ровно 5 вопросов, по 4 варианта, correct_index 0..3.
- code_examples: минимум одна строка с комментарием языка в первой строке.

ВЕРНИ ОДИН JSON-объект:
{
  "theory": "...",
  "code_examples": ["..."],
  "quiz": [
    {"question":"...","choices":["","","",""],"correct_index":0}
  ],
  "flashcards": [
    {"question":"...","answer":"..."}
  ]
}`.trim();
}

/** Укорщик для промпта 2–3, чтобы не раздувать контекст. */
export function excerptForChainedPrompt(text: string, maxChars = 1200): string {
  const t = (text ?? '').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…`;
}
