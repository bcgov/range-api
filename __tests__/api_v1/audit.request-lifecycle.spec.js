vi.mock('passport');
import request from 'supertest';
import passport from 'passport';
import express from 'express';
import AuditLog from '../../src/libs/db2/model/auditlog.js';
import { requestAuditMiddleware, resetAuditHealthSnapshot } from '../../src/libs/audit.js';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(requestAuditMiddleware({}));

  app.get('/public/ping', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(passport.authenticate('jwt', { session: false }));

  app.get('/secure/read', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post('/secure/mutate', (req, res) => {
    res.status(201).json({ ok: true });
  });

  return app;
};

const flushFinishHandlers = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('audit request lifecycle coverage', () => {
  const prevEnableAudit = process.env.ENABLE_AUDIT_LOG;
  const originalAuthenticate = passport.authenticate;

  beforeAll(() => {
    process.env.ENABLE_AUDIT_LOG = 'true';
  });

  afterAll(() => {
    if (prevEnableAudit === undefined) {
      delete process.env.ENABLE_AUDIT_LOG;
    } else {
      process.env.ENABLE_AUDIT_LOG = prevEnableAudit;
    }

    passport.authenticate = originalAuthenticate;
  });

  beforeEach(() => {
    resetAuditHealthSnapshot();
    AuditLog.create = vi.fn().mockResolvedValue({ id: 1 });
    passport.authenticate = vi.fn(() => (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (authHeader === 'Bearer rejected-token') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.user = {
        id: 41,
        roleId: 2,
      };

      return next();
    });
  });

  test('authenticated read emits one request audit event with actor and correlation precedence', async () => {
    const app = buildApp();

    await request(app)
      .get('/secure/read')
      .set('authorization', 'Bearer valid-token')
      .set('x-request-id', 'rid-read')
      .set('x-correlation-id', 'cid-read')
      .expect(200);

    await flushFinishHandlers();

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.userId).toBe(41);
    expect(payload.roleId).toBe(2);
    expect(payload.method).toBe('GET');
    expect(payload.path).toBe('/secure/read');
    expect(payload.correlationId).toBe('cid-read');
    expect(payload.success).toBe(true);
    expect(payload.statusCode).toBe(200);
  });

  test('authenticated mutation emits one request audit event', async () => {
    const app = buildApp();

    await request(app)
      .post('/secure/mutate')
      .set('authorization', 'Bearer valid-token')
      .set('x-request-id', 'rid-mutate')
      .send({ value: 1 })
      .expect(201);

    await flushFinishHandlers();

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.userId).toBe(41);
    expect(payload.method).toBe('POST');
    expect(payload.path).toBe('/secure/mutate');
    expect(payload.statusCode).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.correlationId).toBe('rid-mutate');
  });

  test('unauthenticated pre-auth route emits request audit event with nullable actor', async () => {
    const app = buildApp();

    await request(app).get('/public/ping').expect(200);

    await flushFinishHandlers();

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.userId).toBe(null);
    expect(payload.authReasonCode).toBe(null);
    expect(payload.path).toBe('/public/ping');
    expect(payload.statusCode).toBe(200);
  });

  test('failed auth without bearer token emits coarse reason code', async () => {
    const app = buildApp();

    await request(app).get('/secure/read').expect(401);

    await flushFinishHandlers();

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.userId).toBe(null);
    expect(payload.authReasonCode).toBe('missing_bearer_token');
    expect(payload.statusCode).toBe(401);
  });

  test('failed auth with bearer token emits rejected coarse reason code', async () => {
    const app = buildApp();

    await request(app).get('/secure/read').set('authorization', 'Bearer rejected-token').expect(401);

    await flushFinishHandlers();

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.userId).toBe(null);
    expect(payload.authReasonCode).toBe('invalid_or_rejected_token');
    expect(payload.statusCode).toBe(401);
  });
});
