"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const request = require("supertest");
const app_module_1 = require("../src/app.module");
describe('Auth (e2e)', () => {
    let app;
    let accessToken;
    const credentials = {
        email: `e2e_${Date.now()}@test.com`,
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
    describe('POST /api/auth/register', () => {
        it('registers a new user and returns access_token + user', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(credentials)
                .expect(201);
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.email).toBe(credentials.email);
            expect(res.body.user).not.toHaveProperty('passwordHash');
            expect(res.body.user).not.toHaveProperty('password_hash');
        });
        it('rejects duplicate email with 409', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/register')
                .send(credentials)
                .expect(409);
        });
        it('rejects invalid email with 400', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({ email: 'not-an-email', password: 'password123', skill_level: 'beginner' })
                .expect(400);
        });
        it('rejects short password with 400', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({ email: 'new@test.com', password: 'short', skill_level: 'beginner' })
                .expect(400);
        });
        it('rejects invalid skill_level with 400', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/register')
                .send({ email: 'new2@test.com', password: 'password123', skill_level: 'expert' })
                .expect(400);
        });
    });
    describe('POST /api/auth/login', () => {
        it('logs in and returns access_token + user', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: credentials.email, password: credentials.password })
                .expect(201);
            expect(res.body).toHaveProperty('access_token');
            expect(typeof res.body.access_token).toBe('string');
            expect(res.body.user.email).toBe(credentials.email);
            expect(res.body.user).not.toHaveProperty('passwordHash');
            accessToken = res.body.access_token;
        });
        it('rejects wrong password with 401', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: credentials.email, password: 'wrong_password' })
                .expect(401);
        });
        it('rejects unknown email with 401', async () => {
            await request(app.getHttpServer())
                .post('/api/auth/login')
                .send({ email: 'nobody@test.com', password: 'password123' })
                .expect(401);
        });
    });
    describe('GET /api/auth/me', () => {
        it('returns user profile with valid token', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);
            expect(res.body.email).toBe(credentials.email);
            expect(res.body.skillLevel).toBe(credentials.skill_level);
            expect(res.body).not.toHaveProperty('passwordHash');
            expect(res.body).not.toHaveProperty('password_hash');
        });
        it('rejects request without token with 401', async () => {
            await request(app.getHttpServer())
                .get('/api/auth/me')
                .expect(401);
        });
        it('rejects request with invalid token with 401', async () => {
            await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid.token.here')
                .expect(401);
        });
    });
});
//# sourceMappingURL=auth.e2e-spec.js.map