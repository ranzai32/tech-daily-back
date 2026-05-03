import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
} from '@google/generative-ai';

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

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private model: GenerativeModel;
  private flashcardModel: GenerativeModel;

  onModuleInit() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    this.model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
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
          required: ['title', 'content', 'whyItMatters', 'difficulty', 'estimatedMinutes', 'tags'],
        },
      },
    });

    this.flashcardModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
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
    const result = await this.model.generateContent(prompt);
    return JSON.parse(result.response.text()) as CuratedLesson;
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

    const result = await this.model.generateContent(prompt);
    return JSON.parse(result.response.text()) as CuratedLesson;
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

    const result = await this.flashcardModel.generateContent(prompt);
    return JSON.parse(result.response.text()) as GeneratedFlashcard[];
  }
}
