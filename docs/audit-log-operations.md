# Audit Log Operations

## Retention

- Retention target is one year (365 days).
- Runtime scheduler attempts retention cleanup daily when `ENABLE_AUDIT_RETENTION_CLEANUP` is enabled.
- Manual cleanup command: `npm run audit_retention_cleanup`
- Optional override for cleanup window: `AUDIT_RETENTION_DAYS`

## Observability

- Health endpoint: `GET /api/v1/ehlo`
- Response includes `audit` health counters:
  - `requestWriteFailures`
  - `domainWriteFailures`
  - `retentionRuns`
  - `retentionFailures`
  - `lastRetentionRunAt`
  - `lastRetentionDeletedCount`
  - `lastRetentionError`

## Investigation Queries

- By actor: filter by `user_id` and `created_at` range.
- By entity: filter by `entity_type` and `entity_id`.
- By request correlation: filter by `request_id` or `correlation_id`.
- By agreement: filter by `agreement_id`.

## Notes

- Request-level auditing remains fail-open.
- Domain audit write failures are logged and counted in health snapshots.
