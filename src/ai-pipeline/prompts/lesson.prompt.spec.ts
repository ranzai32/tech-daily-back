import {
  LESSON_PROMPT_TEMPLATE,
  buildLessonPrompt,
} from './lesson.prompt';

describe('lesson.prompt', () => {
  it('template contains all placeholder markers', () => {
    expect(LESSON_PROMPT_TEMPLATE).toContain('{items}');
    expect(LESSON_PROMPT_TEMPLATE).toContain('{skill_level}');
    expect(LESSON_PROMPT_TEMPLATE).toContain('{topic}');
    expect(LESSON_PROMPT_TEMPLATE).toContain('{user_progress_context}');
  });

  it('buildLessonPrompt substitutes all placeholders', () => {
    const prompt = buildLessonPrompt(
      'item-a; item-b',
      'intermediate',
      'Rust',
      'Завершено уроков 3',
    );
    expect(prompt).toContain('item-a; item-b');
    expect(prompt).toContain('intermediate');
    expect(prompt).toContain('Rust');
    expect(prompt).toContain('Завершено уроков 3');
    expect(prompt).not.toContain('{items}');
    expect(prompt).not.toContain('{skill_level}');
    expect(prompt).not.toContain('{topic}');
    expect(prompt).not.toContain('{user_progress_context}');
  });
});
