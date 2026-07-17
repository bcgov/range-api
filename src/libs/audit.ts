import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { logger } from './bcgov-shim.js';
import AuditLog from './db2/model/auditlog.js';

const MAX_METADATA_LENGTH = 12 * 1024;
const MAX_STRING_LENGTH = 300;
const MAX_ARRAY_ITEMS = 25;
const MAX_DEPTH = 5;
const DEFAULT_RETENTION_DAYS = 365;
const DEFAULT_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

const REDACTED = '[REDACTED]';
const sensitiveKeyPatterns = [/authorization/i, /cookie/i, /token/i, /password/i, /secret/i, /api[_-]?key/i];

export interface DomainAuditPayload {
  requestId?: string | null;
  correlationId?: string | null;
  userId: number | null;
  roleId?: number | null;
  method?: string;
  path?: string;
  route?: string | null;
  statusCode?: number;
  durationMs?: number | null;
  success?: boolean;
  action: string;
  entityType: string;
  entityId: string | number;
  agreementId?: string | null;
  metadata?: unknown;
}

export interface AuditHealthSnapshot {
  requestWriteFailures: number;
  domainWriteFailures: number;
  retentionRuns: number;
  retentionFailures: number;
  lastRetentionRunAt: string | null;
  lastRetentionDeletedCount: number;
  lastRetentionError: string | null;
}

export interface BackgroundJobAuditOptions {
  metadata?: unknown;
}

interface DeleteResultRow {
  numDeletedRows?: number | string | bigint;
}

interface DeleteExecutor {
  executeTakeFirst(): Promise<DeleteResultRow | undefined>;
}

interface DeleteWhereBuilder {
  where(column: string, op: '<', value: Date): DeleteExecutor;
}

interface RetentionDb {
  deleteFrom(table: string): DeleteWhereBuilder;
}

interface RetentionSchedulerOptions {
  intervalMs?: number;
  retentionDays?: number;
}

interface HealthSnapshotOptions {
  includeErrors?: boolean;
}

const auditHealth: AuditHealthSnapshot = {
  requestWriteFailures: 0,
  domainWriteFailures: 0,
  retentionRuns: 0,
  retentionFailures: 0,
  lastRetentionRunAt: null,
  lastRetentionDeletedCount: 0,
  lastRetentionError: null,
};

let retentionSchedulerStopper: (() => void) | null = null;

export function isAuditEnabled(): boolean {
  const raw = process.env.ENABLE_AUDIT_LOG;
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  const env = process.env.NODE_ENV || '';
  return !['test', 'unit_test'].includes(env);
}

export function isAuditRetentionEnabled(): boolean {
  const raw = process.env.ENABLE_AUDIT_RETENTION_CLEANUP;
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  const env = process.env.NODE_ENV || '';
  return !['test', 'unit_test'].includes(env);
}

export function getAuditHealthSnapshot(options: HealthSnapshotOptions = {}): AuditHealthSnapshot {
  const includeErrors = options.includeErrors === true;
  return {
    ...auditHealth,
    lastRetentionError: includeErrors ? auditHealth.lastRetentionError : null,
  };
}

export function resetAuditHealthSnapshot(): void {
  auditHealth.requestWriteFailures = 0;
  auditHealth.domainWriteFailures = 0;
  auditHealth.retentionRuns = 0;
  auditHealth.retentionFailures = 0;
  auditHealth.lastRetentionRunAt = null;
  auditHealth.lastRetentionDeletedCount = 0;
  auditHealth.lastRetentionError = null;
}

export function parseRetentionDays(raw: string | undefined): number {
  const parsed = Number(raw || DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 3650) {
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

export function getRetentionCutoff(now: Date = new Date(), retentionDays: number = DEFAULT_RETENTION_DAYS): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

export async function purgeExpiredAuditLogs(
  db: RetentionDb,
  now: Date = new Date(),
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): Promise<number> {
  const cutoff = getRetentionCutoff(now, retentionDays);
  const result = await db.deleteFrom('audit_log').where('created_at', '<', cutoff).executeTakeFirst();

  if (!result?.numDeletedRows) return 0;
  return Number(result.numDeletedRows);
}

async function runAuditRetentionCleanup(db: RetentionDb, retentionDays: number): Promise<void> {
  const now = new Date();
  try {
    const deletedCount = await purgeExpiredAuditLogs(db, now, retentionDays);
    auditHealth.retentionRuns += 1;
    auditHealth.lastRetentionRunAt = now.toISOString();
    auditHealth.lastRetentionDeletedCount = deletedCount;
    auditHealth.lastRetentionError = null;

    if (deletedCount > 0) {
      logger.info(`audit retention cleanup deleted ${deletedCount} rows older than ${retentionDays} days`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    auditHealth.retentionRuns += 1;
    auditHealth.retentionFailures += 1;
    auditHealth.lastRetentionRunAt = now.toISOString();
    auditHealth.lastRetentionError = message;
    logger.error(`audit retention cleanup failed: ${message}`);
  }
}

export function startAuditRetentionScheduler(db: RetentionDb, options: RetentionSchedulerOptions = {}): () => void {
  if (!isAuditRetentionEnabled()) {
    return () => {};
  }

  if (retentionSchedulerStopper) {
    return retentionSchedulerStopper;
  }

  const intervalMs = options.intervalMs || DEFAULT_RETENTION_INTERVAL_MS;
  const retentionDays = options.retentionDays || parseRetentionDays(process.env.AUDIT_RETENTION_DAYS);
  const stopWithReset = () => {
    clearInterval(timer);
    retentionSchedulerStopper = null;
  };

  void runAuditRetentionCleanup(db, retentionDays).then(() => {
    if (
      auditHealth.lastRetentionError &&
      auditHealth.lastRetentionError.includes('relation "audit_log" does not exist')
    ) {
      logger.warn('audit retention cleanup disabled: audit_log table is missing');
      stopWithReset();
    }
  });

  const timer = setInterval(() => {
    void runAuditRetentionCleanup(db, retentionDays).then(() => {
      if (
        auditHealth.lastRetentionError &&
        auditHealth.lastRetentionError.includes('relation "audit_log" does not exist')
      ) {
        logger.warn('audit retention cleanup disabled: audit_log table is missing');
        stopWithReset();
      }
    });
  }, intervalMs);

  retentionSchedulerStopper = stopWithReset;

  return retentionSchedulerStopper;
}

export function stopAuditRetentionSchedulerForTests(): void {
  if (retentionSchedulerStopper) {
    retentionSchedulerStopper();
  }
}

export function getCorrelationId(headers: Request['headers']): string {
  const correlation = headers['x-correlation-id'];
  const requestId = headers['x-request-id'];

  const first = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return value[0];
    return value;
  };

  return first(correlation) || first(requestId) || randomUUID();
}

export function redactValue(value: unknown, depth: number = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return '[TRUNCATED_DEPTH]';
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (sensitiveKeyPatterns.some((pattern) => pattern.test(key))) {
        output[key] = REDACTED;
        continue;
      }
      output[key] = redactValue(raw, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function capMetadata(metadata: unknown): unknown {
  const redacted = redactValue(metadata);
  const serialized = JSON.stringify(redacted);

  if (!serialized || serialized.length <= MAX_METADATA_LENGTH) {
    return redacted;
  }

  return {
    truncated: true,
    maxLength: MAX_METADATA_LENGTH,
    originalLength: serialized.length,
  };
}

export async function writeDomainAudit(db: unknown, payload: DomainAuditPayload): Promise<void> {
  if (!isAuditEnabled()) return;

  try {
    await AuditLog.create(db, {
      requestId: payload.requestId || null,
      correlationId: payload.correlationId || null,
      userId: payload.userId,
      roleId: payload.roleId || null,
      method: payload.method || 'SYSTEM',
      path: payload.path || 'system',
      route: payload.route || null,
      statusCode: payload.statusCode || 200,
      durationMs: payload.durationMs ?? null,
      success: payload.success !== false,
      authReasonCode: null,
      action: payload.action,
      entityType: payload.entityType,
      entityId: String(payload.entityId),
      agreementId: payload.agreementId || null,
      metadata: capMetadata(payload.metadata || {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    auditHealth.domainWriteFailures += 1;
    logger.error(`domain audit write failed: ${message}`);
  }
}

export async function runAuditedBackgroundJob<T>(
  db: unknown,
  jobName: string,
  runner: () => Promise<T>,
  options: BackgroundJobAuditOptions = {},
): Promise<T> {
  await writeDomainAudit(db, {
    userId: null,
    method: 'SYSTEM',
    path: `background_job.${jobName}`,
    action: 'background_job.started',
    entityType: 'background_job',
    entityId: jobName,
    metadata: options.metadata,
  });

  try {
    const result = await runner();
    await writeDomainAudit(db, {
      userId: null,
      method: 'SYSTEM',
      path: `background_job.${jobName}`,
      action: 'background_job.completed',
      entityType: 'background_job',
      entityId: jobName,
      metadata: options.metadata,
    });
    return result;
  } catch (err) {
    await writeDomainAudit(db, {
      userId: null,
      method: 'SYSTEM',
      path: `background_job.${jobName}`,
      action: 'background_job.failed',
      entityType: 'background_job',
      entityId: jobName,
      metadata: {
        ...((options.metadata as Record<string, unknown>) || {}),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
