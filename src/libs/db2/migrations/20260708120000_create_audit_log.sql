-- migrate:up
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  request_id TEXT,
  correlation_id TEXT,
  user_id INTEGER,
  role_id INTEGER,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  route TEXT,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  auth_reason_code TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  agreement_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_agreement_id_idx ON audit_log (agreement_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_request_id_idx ON audit_log (request_id);
CREATE INDEX IF NOT EXISTS audit_log_correlation_id_idx ON audit_log (correlation_id);

-- migrate:down
DROP INDEX IF EXISTS audit_log_correlation_id_idx;
DROP INDEX IF EXISTS audit_log_request_id_idx;
DROP INDEX IF EXISTS audit_log_entity_idx;
DROP INDEX IF EXISTS audit_log_agreement_id_idx;
DROP INDEX IF EXISTS audit_log_user_id_idx;
DROP INDEX IF EXISTS audit_log_created_at_idx;
DROP TABLE IF EXISTS audit_log;
