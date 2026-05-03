import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Lesson } from '../src/modules/lessons/lesson.entity';
import { SkillLevel } from '../src/common/enums/skill-level.enum';

describe('Full happy path (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let lessonId = '';
  let bookmarkId = '';
  let selectedTopicIds: string[] = [];

  const credentials = {
    email: `happy_path_${Date.now()}@test.com`,
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

  it('1) register -> login -> JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);

    expect(loginRes.body.access_token).toBeDefined();
    accessToken = loginRes.body.access_token as string;
  });

  it('2) POST /users/topics choose 3 topics', async () => {
    const topicsRes = await request(app.getHttpServer()).get('/api/topics').expect(200);
    selectedTopicIds = (topicsRes.body as Array<{ id: string }>)
      .slice(0, 3)
      .map((t) => t.id);

    await request(app.getHttpServer())
      .post('/api/users/topics')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ topic_ids: selectedTopicIds })
      .expect(201);
  });

  it('seed published lesson with 3 flashcards', async () => {
    const ds = app.get(DataSource);
    const repo = ds.getRepository(Lesson);
    const now = new Date();
    const row = await repo.save(
      repo.create({
        title: 'Happy path lesson',
        content: 'Summary',
        whyItMatters: 'Why it matters',
        topicId: selectedTopicIds[0],
        sourceUrl: 'https://github.com/example/repo',
        sourceUrls: [
          'https://github.com/example/repo',
          'https://news.ycombinator.com/item?id=123',
        ],
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
          { question: 'Q3', answer: 'A3' },
        ],
      }),
    );
    lessonId = row.id;
  });

  it('3) GET /lessons/today -> lesson', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/lessons/today')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.lesson).toBeTruthy();
    expect(res.body.lesson.id).toBe(lessonId);
  });

  it('4) POST /lessons/:id/complete -> streak = 1', async () => {
    await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const streak = await request(app.getHttpServer())
      .get('/api/streaks/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(streak.body.current_streak).toBe(1);
  });

  it('5) GET /flashcards/:lesson_id -> 3 flashcards', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/flashcards/${lessonId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
  });

  it('6) POST /bookmarks -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lesson_id: lessonId })
      .expect(201);
    bookmarkId = res.body.id as string;
    expect(bookmarkId).toBeDefined();
  });

  it('7) GET /bookmarks -> 1 bookmark', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
  });

  it("8) PATCH /users/settings skill_level 'intermediate' -> 200", async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ skill_level: 'intermediate' })
      .expect(200);
    expect(res.body.skill_level).toBe('intermediate');
  });

  it('9) DELETE /bookmarks/:id -> 204', async () => {
    await request(app.getHttpServer())
      .delete(`/api/bookmarks/${bookmarkId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });
});
