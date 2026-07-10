import AuditLog from '../../src/libs/db2/model/auditlog.js';
import {
  capMetadata,
  getCorrelationId,
  getAuditHealthSnapshot,
  isAuditEnabled,
  parseRetentionDays,
  purgeExpiredAuditLogs,
  redactValue,
  resetAuditHealthSnapshot,
  stopAuditRetentionSchedulerForTests,
  startAuditRetentionScheduler,
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
    resetAuditHealthSnapshot();
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

  test('tracks domain write failures in health snapshot', async () => {
    resetAuditHealthSnapshot();
    AuditLog.create = vi.fn().mockRejectedValue(new Error('db down'));

    await writeDomainAudit(
      {},
      {
        action: 'plan.status.changed',
        entityType: 'plan',
        entityId: 88,
        userId: 5,
      },
    );

    const snapshot = getAuditHealthSnapshot();
    expect(snapshot.domainWriteFailures).toBe(1);
  });
});

describe('audit retention', () => {
  afterEach(() => {
    stopAuditRetentionSchedulerForTests();
  });

  test('purges records older than retention window', async () => {
    const executeTakeFirst = vi.fn().mockResolvedValue({ numDeletedRows: 9n });
    const where = vi.fn().mockReturnValue({ executeTakeFirst });
    const deleteFrom = vi.fn().mockReturnValue({ where });

    const deleted = await purgeExpiredAuditLogs({ deleteFrom }, new Date('2026-07-08T00:00:00.000Z'), 365);

    expect(deleteFrom).toHaveBeenCalledWith('audit_log');
    expect(where).toHaveBeenCalledTimes(1);
    expect(where.mock.calls[0][0]).toBe('created_at');
    expect(where.mock.calls[0][1]).toBe('<');
    expect(where.mock.calls[0][2].toISOString()).toBe('2025-07-08T00:00:00.000Z');
    expect(deleted).toBe(9);
  });

  test('scheduler performs cleanup and updates health', async () => {
    resetAuditHealthSnapshot();
    const prevRetention = process.env.ENABLE_AUDIT_RETENTION_CLEANUP;
    process.env.ENABLE_AUDIT_RETENTION_CLEANUP = 'true';

    try {
      const executeTakeFirst = vi.fn().mockResolvedValue({ numDeletedRows: 3 });
      const where = vi.fn().mockReturnValue({ executeTakeFirst });
      const deleteFrom = vi.fn().mockReturnValue({ where });

      const stop = startAuditRetentionScheduler({ deleteFrom }, { intervalMs: 15, retentionDays: 365 });
      await new Promise((resolve) => setTimeout(resolve, 30));
      stop();

      const snapshot = getAuditHealthSnapshot();
      expect(snapshot.retentionRuns).toBeGreaterThan(0);
      expect(snapshot.retentionFailures).toBe(0);
      expect(snapshot.lastRetentionDeletedCount).toBe(3);
    } finally {
      if (prevRetention === undefined) {
        delete process.env.ENABLE_AUDIT_RETENTION_CLEANUP;
      } else {
        process.env.ENABLE_AUDIT_RETENTION_CLEANUP = prevRetention;
      }
    }
  });

  test('scheduler disables itself when audit_log table is missing', async () => {
    resetAuditHealthSnapshot();
    const prevRetention = process.env.ENABLE_AUDIT_RETENTION_CLEANUP;
    process.env.ENABLE_AUDIT_RETENTION_CLEANUP = 'true';

    try {
      const executeTakeFirst = vi.fn().mockRejectedValue(new Error('relation "audit_log" does not exist'));
      const where = vi.fn().mockReturnValue({ executeTakeFirst });
      const deleteFrom = vi.fn().mockReturnValue({ where });

      const stop = startAuditRetentionScheduler({ deleteFrom }, { intervalMs: 60, retentionDays: 365 });
      await new Promise((resolve) => setTimeout(resolve, 30));
      stop();

      expect(deleteFrom).toHaveBeenCalledTimes(1);
      const snapshot = getAuditHealthSnapshot({ includeErrors: true });
      expect(snapshot.retentionFailures).toBeGreaterThan(0);
      expect(snapshot.lastRetentionError).toContain('relation "audit_log" does not exist');
    } finally {
      if (prevRetention === undefined) {
        delete process.env.ENABLE_AUDIT_RETENTION_CLEANUP;
      } else {
        process.env.ENABLE_AUDIT_RETENTION_CLEANUP = prevRetention;
      }
    }
  });

  test('parseRetentionDays guards invalid values', () => {
    expect(parseRetentionDays(undefined)).toBe(365);
    expect(parseRetentionDays('30')).toBe(30);
    expect(parseRetentionDays('-1')).toBe(365);
    expect(parseRetentionDays('NaN')).toBe(365);
    expect(parseRetentionDays('4000')).toBe(365);
  });

  test('health snapshot hides internal errors by default', () => {
    resetAuditHealthSnapshot();
    const hidden = getAuditHealthSnapshot();
    const visible = getAuditHealthSnapshot({ includeErrors: true });

    expect(hidden.lastRetentionError).toBe(null);
    expect(visible.lastRetentionError).toBe(null);
  });
});
