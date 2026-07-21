import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/libs/authmware.js', () => ({
  default: vi.fn(async () => {}),
}));

vi.mock('../../src/router/index.js', () => ({
  default: (app: { get: (path: string, handler: () => Promise<void>) => void }) => {
    app.get('/boom', async () => {
      const err = new Error('boom') as Error & { code?: number };
      err.code = 418;
      throw err;
    });
  },
}));

describe('createApp error handler', () => {
  it('returns JSON error response without rethrowing', async () => {
    const { default: createApp } = await import('../../src/index.js');
    const app = await createApp();

    const response = await request(app).get('/boom');

    expect(response.status).toBe(418);
    expect(response.body).toEqual({
      error: 'boom',
      success: false,
    });
  });
});
