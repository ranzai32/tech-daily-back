"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const request = require("supertest");
const app_module_1 = require("../src/app.module");
describe('Onboarding flow (e2e)', () => {
    let app;
    let accessToken;
    let topicIds;
    const credentials = {
        email: `onboarding_${Date.now()}@test.com`,
        password: 'SecurePass123',
        skill_level: 'beginner',
    };
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
    }, 30000);
    afterAll(async () => {
        await app?.close();
    }, 10000);
    it('registers a new user', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/auth/register')
            .send(credentials)
            .expect(201);
        expect(res.body).toHaveProperty('access_token');
        accessToken = res.body.access_token;
    });
    it('GET /api/topics returns 12 topics', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/topics')
            .expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(12);
        const first = res.body[0];
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('slug');
        topicIds = res.body.map((t) => t.id);
    });
    it('GET /api/topics is public (no token needed)', async () => {
        await request(app.getHttpServer())
            .get('/api/topics')
            .expect(200);
    });
    it('POST /api/users/topics saves topic preferences', async () => {
        const selected = topicIds.slice(0, 3);
        const res = await request(app.getHttpServer())
            .post('/api/users/topics')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ topic_ids: selected })
            .expect(201);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(3);
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
    });
    it('POST /api/users/topics rejects empty topic_ids', async () => {
        await request(app.getHttpServer())
            .post('/api/users/topics')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ topic_ids: [] })
            .expect(400);
    });
    it('POST /api/users/topics requires auth', async () => {
        await request(app.getHttpServer())
            .post('/api/users/topics')
            .send({ topic_ids: topicIds.slice(0, 1) })
            .expect(401);
    });
    it('GET /api/users/profile returns profile with topics and streak', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);
        expect(res.body).toHaveProperty('skillLevel', 'beginner');
        expect(Array.isArray(res.body.topics)).toBe(true);
        expect(res.body.topics).toHaveLength(3);
        expect(res.body).toHaveProperty('streak');
        expect(res.body.streak).toHaveProperty('currentStreak');
        expect(res.body.streak).toHaveProperty('longestStreak');
        expect(res.body).not.toHaveProperty('passwordHash');
    });
    it('PATCH /api/users/profile updates skill level', async () => {
        const res = await request(app.getHttpServer())
            .patch('/api/users/profile')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ skill_level: 'advanced' })
            .expect(200);
        expect(res.body).toHaveProperty('skillLevel', 'advanced');
    });
    it('PATCH /api/users/profile rejects invalid skill_level', async () => {
        await request(app.getHttpServer())
            .patch('/api/users/profile')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ skill_level: 'expert' })
            .expect(400);
    });
});
//# sourceMappingURL=onboarding.e2e-spec.js.map