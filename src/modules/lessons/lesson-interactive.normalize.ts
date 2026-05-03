import type {
  LessonInteractivePayload,
  LessonPhase,
  LessonQuizItem,
} from './lesson-interactive.types';

function normalizeQuiz(raw: unknown[]): LessonQuizItem[] {
  const out: LessonQuizItem[] = [];
  for (const q of raw.slice(0, 6)) {
    if (!q || typeof q !== 'object') continue;
    const o = q as {
      question?: unknown;
      choices?: unknown;
      correct_index?: unknown;
    };
    const choices = Array.isArray(o.choices)
      ? o.choices.map((c) => String(c).trim()).filter(Boolean)
      : [];
    if (choices.length < 2) continue;
    let correct = Number(o.correct_index);
    if (
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= choices.length
    ) {
      correct = 0;
    }
    const question = String(o.question ?? '').trim();
    if (!question) continue;
    out.push({ question, choices, correct_index: correct });
  }
  return out.slice(0, 5);
}

/** Нормализация ответа модели: ровно 3 фазы по 5 вопросов при возможности. */
export function normalizeLessonInteractivePayload(
  phasesRaw: unknown,
): LessonInteractivePayload | null {
  if (!Array.isArray(phasesRaw) || phasesRaw.length < 3) return null;

  const phases: LessonPhase[] = [];
  for (let i = 0; i < 3; i++) {
    const p = phasesRaw[i];
    if (!p || typeof p !== 'object') return null;
    const po = p as {
      theory?: unknown;
      code_examples?: unknown;
      quiz?: unknown;
    };
    const theory = String(po.theory ?? '').trim();
    const code_examples = Array.isArray(po.code_examples)
      ? po.code_examples.map((c) => String(c))
      : [];
    const quizArr = Array.isArray(po.quiz) ? po.quiz : [];
    const quiz = normalizeQuiz(quizArr);
    if (quiz.length < 4) return null;
    phases.push({
      theory:
        theory ||
        'Теоретический блок. Сопоставь это с последующими тестами и примерами кода выше.',
      code_examples,
      quiz,
    });
  }
  return { phases };
}
