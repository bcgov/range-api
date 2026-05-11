import { default as request } from 'supertest';
import createApp from '../src/index.js';

describe('Auth middleware', () => {
  test('returns 401 when no token is provided', async () => {
    const app = await createApp();
    await request(app).get('/api/v1/user').expect(401);
  });
});
