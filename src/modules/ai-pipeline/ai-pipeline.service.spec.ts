import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AiPipelineService } from './ai-pipeline.service';
import { GeminiService } from './gemini.service';
import { TopicsService } from '../topics/topics.service';
import { UsersService } from '../users/users.service';
import { LessonsService } from '../lessons/lessons.service';
import { DAILY_CURATION_QUEUE } from './review.queue';
import { SkillLevel } from '../../common/enums/skill-level.enum';

describe('AiPipelineService', () => {
  let service: AiPipelineService;
  let gemini: { generateDailyLesson: jest.Mock };
  let lessons: {
    createAiDraft: jest.Mock;
    findLastApprovedByTopic: jest.Mock;
    cloneFallbackDraft: jest.Mock;
    approveLesson: jest.Mock;
    invalidateTodayLessonCache: jest.Mock;
  };

  beforeEach(async () => {
    gemini = {
      generateDailyLesson: jest.fn().mockResolvedValue({
        title: 'Lesson title',
        summary: 'Summary text for the lesson.',
        why_it_matters: 'Why it matters for developers.',
        source_urls: ['https://example.com/a', 'https://example.com/b'],
        flashcards: [
          { question: 'Q1?', answer: 'A1' },
          { question: 'Q2?', answer: 'A2' },
          { question: 'Q3?', answer: 'A3' },
        ],
      }),
    };
    lessons = {
      createAiDraft: jest.fn().mockResolvedValue({
        id: 'lesson-uuid-1',
        title: 'Lesson title',
        content: 'Summary text for the lesson.',
        whyItMatters: 'Why it matters for developers.',
        sourceUrl: 'https://example.com/a',
        flashcardsPayload: [
          { question: 'Q1?', answer: 'A1' },
          { question: 'Q2?', answer: 'A2' },
          { question: 'Q3?', answer: 'A3' },
        ],
        topicId: 'topic-1',
      }),
      findLastApprovedByTopic: jest.fn().mockResolvedValue(null),
      cloneFallbackDraft: jest.fn(),
      approveLesson: jest.fn().mockImplementation(async (id: string) => ({
        id,
        title: 'Lesson title',
        content: 'Summary text for the lesson.',
        whyItMatters: 'Why it matters for developers.',
        sourceUrl: 'https://example.com/a',
        flashcardsPayload: [
          { question: 'Q1?', answer: 'A1' },
          { question: 'Q2?', answer: 'A2' },
          { question: 'Q3?', answer: 'A3' },
        ],
        topicId: 'topic-1',
      })),
      invalidateTodayLessonCache: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPipelineService,
        { provide: GeminiService, useValue: gemini },
        {
          provide: TopicsService,
          useValue: {
            getUserTopics: jest.fn().mockResolvedValue([
              { id: 'topic-1', name: 'Rust', slug: 'rust' },
            ]),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue({
              id: 'user-1',
              skillLevel: SkillLevel.Intermediate,
            }),
            buildLessonAiProgressSnippet: jest
              .fn()
              .mockResolvedValue('Прогресс: 0 уроков'),
          },
        },
        { provide: LessonsService, useValue: lessons },
        {
          provide: getQueueToken(DAILY_CURATION_QUEUE),
          useValue: {
            getWaitingCount: jest.fn().mockResolvedValue(0),
            getActiveCount: jest.fn().mockResolvedValue(0),
            getCompletedCount: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get(AiPipelineService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [], items: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('curateDailyContent returns structured LessonDraft', async () => {
    const draft = await service.curateDailyContent('user-1');

    expect(draft.lessonId).toBe('lesson-uuid-1');
    expect(draft.userId).toBe('user-1');
    expect(draft.topicId).toBe('topic-1');
    expect(draft.topicName).toBe('Rust');
    expect(draft.title).toBe('Lesson title');
    expect(draft.summary).toContain('Summary');
    expect(draft.whyItMatters).toContain('matters');
    expect(draft.sourceUrls).toContain('https://example.com/a');
    expect(draft.flashcards).toHaveLength(3);
    expect(draft.flashcards[0]).toEqual(
      expect.objectContaining({ question: expect.any(String), answer: expect.any(String) }),
    );
    expect(draft.usedFallback).toBe(false);
    expect(gemini.generateDailyLesson).toHaveBeenCalledWith(
      expect.objectContaining({
        itemsJson: expect.any(String),
        skillLevel: SkillLevel.Intermediate,
        topic: 'Rust',
      }),
    );
    expect(lessons.createAiDraft).toHaveBeenCalled();
    expect(lessons.approveLesson).not.toHaveBeenCalled();
    expect(lessons.invalidateTodayLessonCache).toHaveBeenCalledWith('user-1');
  });

  it('curateDailyContent auto-publishes when AI_AUTO_PUBLISH_CURATED_LESSONS=true', async () => {
    process.env.AI_AUTO_PUBLISH_CURATED_LESSONS = 'true';
    const draft = await service.curateDailyContent('user-1');
    expect(lessons.approveLesson).toHaveBeenCalledWith('lesson-uuid-1');
    expect(draft.lessonId).toBe('lesson-uuid-1');
    delete process.env.AI_AUTO_PUBLISH_CURATED_LESSONS;
  });

  it('curateDailyContent uses fallback when Gemini fails', async () => {
    gemini.generateDailyLesson.mockRejectedValueOnce(new Error('unavailable'));
    lessons.findLastApprovedByTopic.mockResolvedValueOnce({
      id: 'old-lesson',
      title: 'Old',
      content: 'Body',
      whyItMatters: 'Why',
      sourceUrl: 'https://old',
      flashcardsPayload: [{ question: 'q', answer: 'a' }],
      topicId: 'topic-1',
    });
    lessons.cloneFallbackDraft.mockResolvedValueOnce({
      id: 'new-lesson',
      title: 'Old',
      content: 'Body',
      whyItMatters: 'Why',
      sourceUrl: 'https://old',
      flashcardsPayload: [{ question: 'q', answer: 'a' }],
      topicId: 'topic-1',
    });

    const draft = await service.curateDailyContent('user-1');

    expect(draft.usedFallback).toBe(true);
    expect(draft.lessonId).toBe('new-lesson');
    expect(lessons.cloneFallbackDraft).toHaveBeenCalled();
    expect(lessons.invalidateTodayLessonCache).toHaveBeenCalledWith('user-1');
  });
});
