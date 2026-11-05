const request = require('supertest');
const { setup } = require('./helpers');

describe('auth', () => {
  let ctx;
  beforeEach(() => (ctx = setup()));
  afterEach(() => ctx.db.close());

  test('registers, logs in and reads /me', async () => {
    const reg = await request(ctx.app).post('/api/auth/register').send({ name: 'Ali', email: 'ali@test.dev', password: 'Secret123' });
    expect(reg.status).toBe(201);
    const login = await request(ctx.app).post('/api/auth/login').send({ email: 'ali@test.dev', password: 'Secret123' });
    const me = await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.body.user).toMatchObject({ email: 'ali@test.dev', role: 'customer' });
  });

  test('rejects weak passwords and duplicate emails', async () => {
    const weak = await request(ctx.app).post('/api/auth/register').send({ name: 'Ali', email: 'ali@test.dev', password: 'abc' });
    expect(weak.status).toBe(400);
    await request(ctx.app).post('/api/auth/register').send({ name: 'Ali', email: 'ali@test.dev', password: 'Secret123' });
    const dup = await request(ctx.app).post('/api/auth/register').send({ name: 'Ali', email: 'ALI@test.dev', password: 'Secret123' });
    expect(dup.status).toBe(409);
  });

  test('rotates refresh tokens and detects reuse', async () => {
    const { refreshToken } = (await request(ctx.app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'Admin1234' })).body;
    const first = await request(ctx.app).post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    const replay = await request(ctx.app).post('/api/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
    const newest = await request(ctx.app).post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(newest.status).toBe(401);
  });
});
