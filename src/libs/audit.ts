import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './bcgov-shim.js';
import AuditLog from './db2/model/auditlog.js';

interface AuditUserContext {
  id?: number;
  roleId?: number;
}

interface RouteContext {
  path?: string;
}

type AuditedRequest = Request & {
  user?: AuditUserContext;
  route?: RouteContext;
  auditRequestId?: string;
  auditCorrelationId?: string;
};

const MAX_METADATA_LENGTH = 12 * 1024;
const MAX_STRING_LENGTH = 300;
const MAX_ARRAY_ITEMS = 25;
const MAX_DEPTH = 5;

const REDACTED = '[REDACTED]';
const sensitiveKeyPatterns = [/authorization/i, /cookie/i, /token/i, /password/i, /secret/i, /api[_-]?key/i];

const highRiskPathPatterns = [/\/attachment/i, /\/files/i, /\/emailtemplate/i, /\/exemption/i];
const highRiskAllowedKeys = new Set([
  'planId',
  'agreementId',
  'userId',
  'clientId',
  'exemptionId',
  'extensionRequestId',
]);

export type AuditReasonCode = 'missing_bearer_token' | 'invalid_or_rejected_token';

export interface RequestAuditPayload {
  requestId: string;
  correlationId: string;
  userId: number | null;
  roleId: number | null;
  method: string;
  path: string;
  route: string | null;
  statusCode: number;
  durationMs: number;
  success: boolean;
  authReasonCode: AuditReasonCode | null;
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  agreementId?: string | null;
  metadata?: unknown;
}

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
  authReasonCode?: AuditReasonCode | null;
  action: string;
  entityType: string;
  entityId: string | number;
  agreementId?: string | null;
  metadata?: unknown;
}

export function isAuditEnabled(): boolean {
  const raw = process.env.ENABLE_AUDIT_LOG;
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  const env = process.env.NODE_ENV || '';
  return !['test', 'unit_test'].includes(env);
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

function isHighRiskPath(pathname: string): boolean {
  return highRiskPathPatterns.some((pattern) => pattern.test(pathname));
}

function pickAllowed(data: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (highRiskAllowedKeys.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function deriveAuthReasonCode(req: Request, res: Response): AuditReasonCode | null {
  const auditedReq = req as AuditedRequest;
  if (auditedReq.user) return null;
  if (![401, 403].includes(res.statusCode)) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader) return 'missing_bearer_token';
  return 'invalid_or_rejected_token';
}

function routeValue(req: Request): string | null {
  const auditedReq = req as AuditedRequest;
  if (auditedReq.route && auditedReq.route.path) {
    return `${req.baseUrl || ''}${auditedReq.route.path}`;
  }
  return null;
}

function buildRequestMetadata(req: Request): unknown {
  const highRisk = isHighRiskPath(req.path);
  const params = highRisk ? pickAllowed(req.params as Record<string, unknown>) : req.params;
  const query = highRisk ? pickAllowed(req.query as Record<string, unknown>) : req.query;

  return {
    params,
    query,
    highRisk,
    ip: req.ip,
  };
}

export async function writeRequestAudit(db: unknown, payload: RequestAuditPayload): Promise<void> {
  if (!isAuditEnabled()) return;

  await AuditLog.create(db, {
    requestId: payload.requestId,
    correlationId: payload.correlationId,
    userId: payload.userId,
    roleId: payload.roleId,
    method: payload.method,
    path: payload.path,
    route: payload.route,
    statusCode: payload.statusCode,
    durationMs: payload.durationMs,
    success: payload.success,
    authReasonCode: payload.authReasonCode,
    action: payload.action || null,
    entityType: payload.entityType || null,
    entityId: payload.entityId || null,
    agreementId: payload.agreementId || null,
    metadata: capMetadata(payload.metadata || {}),
  });
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
      authReasonCode: payload.authReasonCode || null,
      action: payload.action,
      entityType: payload.entityType,
      entityId: String(payload.entityId),
      agreementId: payload.agreementId || null,
      metadata: capMetadata(payload.metadata || {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`domain audit write failed: ${message}`);
  }
}

export function requestAuditMiddleware(db: unknown) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auditedReq = req as AuditedRequest;
    const startedAt = Date.now();
    const requestId = randomUUID();
    const correlationId = getCorrelationId(req.headers);

    auditedReq.auditRequestId = requestId;
    auditedReq.auditCorrelationId = correlationId;

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const user = auditedReq.user;
      const payload: RequestAuditPayload = {
        requestId,
        correlationId,
        userId: user?.id || null,
        roleId: user?.roleId || null,
        method: req.method,
        path: req.originalUrl || req.path,
        route: routeValue(req),
        statusCode: res.statusCode,
        durationMs,
        success: res.statusCode < 400,
        authReasonCode: deriveAuthReasonCode(req, res),
        metadata: buildRequestMetadata(req),
      };

      void writeRequestAudit(db, payload).catch((err: Error) => {
        logger.error(`audit write failed: ${err.message}`);
      });
    });

    next();
  };
}
