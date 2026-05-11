import { default as request } from 'supertest';
import express from 'express';

describe('Express 5 async error handling', () => {
  test('async route handler works without asyncMiddleware wrapper', async () => {
    const app = express();

    app.get('/ok', async (req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('async route that throws is caught by error handler', async () => {
    const app = express();

    app.get('/error', async (req, res) => {
      throw new Error('boom');
    });

    app.use((err, req, res, _next) => {
      res.status(500).json({ error: err.message });
    });

    const res = await request(app).get('/error');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('boom');
  });
});
