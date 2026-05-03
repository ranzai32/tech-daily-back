/** Урок: 100% материала, разбит на 3 части — теория + тест. */

export interface LessonQuizItem {
  question: string;
  choices: string[];
  correct_index: number;
}

export interface LessonPhase {
  theory: string;
  code_examples: string[];
  quiz: LessonQuizItem[];
}

export interface LessonInteractivePayload {
  phases: LessonPhase[];
}
