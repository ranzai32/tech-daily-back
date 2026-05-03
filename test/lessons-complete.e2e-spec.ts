import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Lesson } from '../src/modules/lessons/lesson.entity';
import { SkillLevel } from '../src/common/enums/skill-level.enum';

describe('Lesson complete + streak (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let topicId: string;
  let lessonId: string;

  const credentials = {
    email: `lessons_${Date.now()}@test.com`,
    password: 'SecurePass123',
    skill_level: 'beginner',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  }, 10000);

  it('registers user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);
    accessToken = res.body.access_token as string;
  });

  it('picks a topic and saves preferences', async () => {
    const topicsRes = await request(app.getHttpServer())
      .get('/api/topics')
      .expect(200);
    topicId = (topicsRes.body as { id: string }[])[0].id;

    await request(app.getHttpServer())
      .post('/api/users/topics')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ topic_ids: [topicId] })
      .expect(201);
  });

  it('seeds a published lesson for that topic', async () => {
    const ds = app.get(DataSource);
    const repo = ds.getRepository(Lesson);
    const now = new Date();
    const row = await repo.save(
      repo.create({
        title: 'E2E lesson',
        content: 'Summary',
        whyItMatters: 'Because',
        topicId,
        sourceUrl: 'https://news.ycombinator.com/item?id=1',
        sourceUrls: ['https://news.ycombinator.com/item?id=1'],
        difficulty: SkillLevel.Beginner,
        estimatedMinutes: 5,
        isPublished: true,
        reviewedAt: now,
        publishedAt: now,
        rejectionReason: null,
        curatedForUserId: null,
        flashcardsPayload: [
          { question: 'Q1', answer: 'A1' },
          { question: 'Q2', answer: 'A2' },
        ],
      }),
    );
    lessonId = row.id;
  });

  it('GET /api/lessons/today returns the lesson', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/lessons/today')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.lesson).not.toBeNull();
    expect(res.body.lesson.id).toBe(lessonId);
    expect(res.body.lesson.summary).toBe('Summary');
  });

  it('POST /api/lessons/:id/complete updates streak', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/streaks/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.alreadyCompleted).toBe(false);
    expect(res.body.streak.currentStreak).toBeGreaterThanOrEqual(
      before.body.current_streak,
    );
    expect(res.body.streak.currentStreak).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/lessons/today is empty after completion', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/lessons/today')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.lesson).toBeNull();
  });

  it('POST complete again is idempotent for streak', async () => {
    const streak = await request(app.getHttpServer())
      .get('/api/streaks/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.alreadyCompleted).toBe(true);
    expect(res.body.streak.currentStreak).toBe(streak.body.current_streak);
  });
});
