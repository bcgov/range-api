import express from 'express';
import request from 'supertest';
import AuditLog from '../../src/libs/db2/model/auditlog.js';
import {
  capMetadata,
  getCorrelationId,
  isAuditEnabled,
  redactValue,
  requestAuditMiddleware,
  writeDomainAudit,
} from '../../src/libs/audit.js';

describe('audit utilities', () => {
  test('uses correlation header precedence', () => {
    expect(
      getCorrelationId({
        'x-correlation-id': 'cid-1',
        'x-request-id': 'rid-1',
      }),
    ).toBe('cid-1');

    expect(
      getCorrelationId({
        'x-request-id': 'rid-2',
      }),
    ).toBe('rid-2');
  });

  test('redacts sensitive keys', () => {
    const result = redactValue({
      password: 'hello',
      authorization: 'Bearer abc',
      nested: {
        token: 'x',
      },
      safe: 'ok',
    });

    expect(result).toEqual({
      password: '[REDACTED]',
      authorization: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
      },
      safe: 'ok',
    });
  });

  test('truncates large metadata string values', () => {
    const payload = {
      text: 'a'.repeat(40 * 1024),
    };

    const result = capMetadata(payload);
    expect(result.text.endsWith('...[TRUNCATED]')).toBe(true);
  });
});

describe('audit middleware', () => {
  const prevEnableAudit = process.env.ENABLE_AUDIT_LOG;

  beforeAll(() => {
    process.env.ENABLE_AUDIT_LOG = 'true';
  });

  afterAll(() => {
    if (prevEnableAudit === undefined) {
      delete process.env.ENABLE_AUDIT_LOG;
      return;
    }
    process.env.ENABLE_AUDIT_LOG = prevEnableAudit;
  });

  beforeEach(() => {
    expect(isAuditEnabled()).toBe(true);
    AuditLog.create = vi.fn().mockResolvedValue({ id: 1 });
  });

  test('writes request audit for authenticated request', async () => {
    const app = express();
    app.use(requestAuditMiddleware({}));
    app.use((req, _res, next) => {
      req.user = { id: 77, roleId: 3 };
      next();
    });
    app.get('/api/v1/plan/:planId', (req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get('/api/v1/plan/123?token=abc').set('x-correlation-id', 'cid-test').expect(200);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.userId).toBe(77);
    expect(payload.method).toBe('GET');
    expect(payload.success).toBe(true);
    expect(payload.correlationId).toBe('cid-test');
    expect(payload.authReasonCode).toBe(null);
  });

  test('writes request audit for failed auth with coarse reason', async () => {
    const app = express();
    app.use(requestAuditMiddleware({}));
    app.get('/api/v1/exemption/:exemptionId', (req, res) => {
      res.status(401).json({ error: 'Unauthorized' });
    });

    await request(app).get('/api/v1/exemption/9').expect(401);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.userId).toBe(null);
    expect(payload.authReasonCode).toBe('missing_bearer_token');
    expect(payload.metadata.highRisk).toBe(true);
  });
});

describe('domain audit writes', () => {
  const prevEnableAudit = process.env.ENABLE_AUDIT_LOG;

  beforeAll(() => {
    process.env.ENABLE_AUDIT_LOG = 'true';
  });

  afterAll(() => {
    if (prevEnableAudit === undefined) {
      delete process.env.ENABLE_AUDIT_LOG;
      return;
    }
    process.env.ENABLE_AUDIT_LOG = prevEnableAudit;
  });

  test('writes domain events with normalized values', async () => {
    expect(isAuditEnabled()).toBe(true);
    AuditLog.create = vi.fn().mockResolvedValue({ id: 2 });

    await writeDomainAudit(
      {},
      {
        action: 'plan.status.changed',
        entityType: 'plan',
        entityId: 22,
        userId: 1,
        metadata: { secret: 'abc' },
      },
    );

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    const [, payload] = AuditLog.create.mock.calls[0];
    expect(payload.path).toBe('system');
    expect(payload.entityId).toBe('22');
    expect(payload.metadata.secret).toBe('[REDACTED]');
  });
});
