import { Injectable, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { GeminiService, GeminiDailyLessonDraft } from './gemini.service';
import { DAILY_CURATION_QUEUE } from './review.queue';
import { TopicsService } from '../topics/topics.service';
import { UsersService } from '../users/users.service';
import {
  LessonsService,
  AiLessonDraftInput,
} from '../lessons/lessons.service';
import { buildLessonPromptChunk1 } from '../../ai-pipeline/prompts/lesson-chained.prompt';

export interface ContentItem {
  source: 'hn' | 'github';
  title: string;
  url: string;
  score: number;
}

export interface LessonDraft {
  lessonId: string;
  userId: string;
  topicId: string;
  topicName: string;
  title: string;
  summary: string;
  whyItMatters: string;
  sourceUrls: string[];
  flashcards: { question: string; answer: string }[];
  usedFallback: boolean;
}

@Injectable()
export class AiPipelineService {
  private readonly logger = new Logger(AiPipelineService.name);

  constructor(
    @InjectQueue(DAILY_CURATION_QUEUE)
    private readonly dailyCurationQueue: Queue,
    private readonly geminiService: GeminiService,
    private readonly topicsService: TopicsService,
    private readonly usersService: UsersService,
    private readonly lessonsService: LessonsService,
  ) {}

  runGeminiPing() {
    return this.geminiService.ping();
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
  }> {
    const [waiting, active, completed] = await Promise.all([
      this.dailyCurationQueue.getWaitingCount(),
      this.dailyCurationQueue.getActiveCount(),
      this.dailyCurationQueue.getCompletedCount(),
    ]);
    return { waiting, active, completed };
  }

  async curateText(text: string, topicName: string) {
    return this.geminiService.curateFromText(text, topicName);
  }

  async generateFlashcards(lessonContent: string, count = 5) {
    return this.geminiService.generateFlashcards(lessonContent, count);
  }

  async previewDailyCuration(userId: string): Promise<{
    topic: { id: string; name: string; slug: string };
    skillLevel: string;
    topItems: ContentItem[];
    prompt: string;
    gemini: GeminiDailyLessonDraft;
  }> {
    const user = await this.usersService.findById(userId);
    const topics = await this.topicsService.getUserTopics(userId);
    if (!topics.length) {
      throw new BadRequestException('User has no topics');
    }
    const topic = topics[0];
    const topItems = await this.fetchTopContentItems(topic.name);
    const progressSnippet =
      await this.usersService.buildLessonAiProgressSnippet(userId);
    const itemsJson = JSON.stringify(topItems);
    const prompt = buildLessonPromptChunk1(
      itemsJson,
      user.skillLevel,
      topic.name,
      progressSnippet,
    );
    try {
      const gemini = await this.geminiService.generateDailyLesson({
        itemsJson,
        skillLevel: user.skillLevel,
        topic: topic.name,
        userProgressSnippet: progressSnippet,
      });
      return {
        topic: { id: topic.id, name: topic.name, slug: topic.slug },
        skillLevel: user.skillLevel,
        topItems,
        prompt,
        gemini,
      };
    } catch (e) {
      throw new ServiceUnavailableException(
        (e as Error).message || 'Gemini request failed',
      );
    }
  }

  async curateDailyContent(userId: string): Promise<LessonDraft> {
    const user = await this.usersService.findById(userId);
    const topics = await this.topicsService.getUserTopics(userId);
    if (!topics.length) {
      throw new BadRequestException('User has no topics');
    }
    const topic = topics[0];
    const items = await this.fetchTopContentItems(topic.name);
    const progressSnippet =
      await this.usersService.buildLessonAiProgressSnippet(userId);
    const itemsJson = JSON.stringify(items);

    const autoPublish =
      process.env.AI_AUTO_PUBLISH_CURATED_LESSONS === 'true';

    try {
      const ai = await this.geminiService.generateDailyLesson({
        itemsJson,
        skillLevel: user.skillLevel,
        topic: topic.name,
        userProgressSnippet: progressSnippet,
      });
      const input: AiLessonDraftInput = {
        title: ai.title,
        summary: ai.summary,
        whyItMatters: ai.why_it_matters,
        sourceUrls: ai.source_urls,
        flashcards: ai.flashcards,
        topicId: topic.id,
        difficulty: user.skillLevel,
        curatedForUserId: userId,
        interactivePayload:
          ai.phases?.length === 3 ? { phases: ai.phases } : null,
      };
      let saved = await this.lessonsService.createAiDraft(input);
      if (autoPublish) {
        saved = await this.lessonsService.approveLesson(saved.id);
      }
      await this.lessonsService.invalidateTodayLessonCache(userId);
      return this.toLessonDraft(saved, topic.name, userId, false);
    } catch (e) {
      const errMsg =
        e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
      this.logger.warn(`curateDailyContent: Gemini failed, using fallback: ${errMsg}`);
      const fallback = await this.lessonsService.findLastApprovedByTopic(
        topic.id,
      );
      if (!fallback) {
        throw new BadRequestException(
          'Gemini unavailable and no approved lesson fallback for topic',
        );
      }
      let saved = await this.lessonsService.cloneFallbackDraft(
        fallback,
        userId,
      );
      if (autoPublish) {
        saved = await this.lessonsService.approveLesson(saved.id);
      }
      await this.lessonsService.invalidateTodayLessonCache(userId);
      return this.toLessonDraft(saved, topic.name, userId, true);
    }
  }

  private toLessonDraft(
    lesson: {
      id: string;
      title: string;
      content: string;
      whyItMatters: string | null;
      sourceUrl: string | null;
      flashcardsPayload: { question: string; answer: string }[] | null;
      topicId: string;
    },
    topicName: string,
    userId: string,
    usedFallback: boolean,
  ): LessonDraft {
    const sourceUrls = lesson.sourceUrl ? [lesson.sourceUrl] : [];
    return {
      lessonId: lesson.id,
      userId,
      topicId: lesson.topicId,
      topicName,
      title: lesson.title,
      summary: lesson.content,
      whyItMatters: lesson.whyItMatters ?? '',
      sourceUrls,
      flashcards: lesson.flashcardsPayload ?? [],
      usedFallback,
    };
  }

  async fetchTopContentItems(topicName: string): Promise<ContentItem[]> {
    const [hn, gh] = await Promise.all([
      this.fetchHackerNewsStories(topicName),
      this.fetchGitHubRepos(topicName),
    ]);
    const merged: ContentItem[] = [...hn, ...gh];
    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, 3);
  }

  private async fetchHackerNewsStories(
    topic: string,
  ): Promise<ContentItem[]> {
    const url = `https://hn.algolia.com/api/v1/search?tags=story&query=${encodeURIComponent(topic)}&hitsPerPage=15`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits?: {
        title?: string;
        url?: string;
        story_url?: string;
        points?: number;
      }[];
    };
    const hits = data.hits || [];
    return hits
      .filter((h) => h.title)
      .map((h) => ({
        source: 'hn' as const,
        title: h.title as string,
        url: (h.url || h.story_url || '') as string,
        score: Number(h.points ?? 0),
      }))
      .filter((h) => h.url);
  }

  private async fetchGitHubRepos(topic: string): Promise<ContentItem[]> {
    const q = encodeURIComponent(`${topic} in:name,description,readme`);
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=15`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'techdaily-curation',
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        full_name?: string;
        html_url?: string;
        stargazers_count?: number;
      }[];
    };
    const items = data.items || [];
    return items
      .filter((it) => it.full_name && it.html_url)
      .map((it) => ({
        source: 'github' as const,
        title: it.full_name as string,
        url: it.html_url as string,
        score: Number(it.stargazers_count ?? 0),
      }));
  }
}
