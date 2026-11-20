-- =========================================================================
-- Remove plan extension requests that have no client, and zero the vote
-- counters of awaiting-vote plans whose agreement has no clients (#568).
--
-- Root cause: Plan.fetchExpiringPlans left-joins client_agreement, so an
-- agreement with no clients produced a row with a NULL clientId. The old
-- annual extension script created a request from that row and counted it in
-- extension_required_votes, leaving the plan with a required vote that no
-- client or user can ever cast (stored as 1/0). The script now skips rows
-- without a clientId, so these rows should not recur.
--
-- Fix:
--   1. Delete pending requests with no client_id, on any plan. They carry no
--      client, user or vote. Requests with a cast vote are left untouched.
--   2. For plans still awaiting votes (extension_status = 1) whose agreement
--      has no clients, set extension_required_votes and
--      extension_received_votes to 0 so staff can action them. Plans in any
--      other extension status (e.g. replaced) keep their counters.
--
-- Every removed request and counter change is snapshotted in audit_log under
-- path = 'migration.cleanup_null_client_extension_requests'.
-- =========================================================================

-- migrate:up
WITH junk AS (
  SELECT
    per.id,
    per.plan_id,
    per.client_id,
    per.user_id,
    per.requested_extension,
    per.created_at,
    per.updated_at,
    p.agreement_id,
    p.extension_status
  FROM plan_extension_requests per
  JOIN plan p ON p.id = per.plan_id
  WHERE (per.client_id IS NULL OR per.client_id = '')
    AND per.requested_extension IS NULL
)
INSERT INTO audit_log (user_id, method, path, status_code, success, action, entity_type, entity_id, agreement_id, metadata)
SELECT
  1115,
  'SYSTEM',
  'migration.cleanup_null_client_extension_requests',
  200,
  true,
  'plan.updated',
  'plan',
  junk.plan_id::text,
  junk.agreement_id,
  jsonb_build_object(
    'reason', 'extension_requests_cleaned',
    'extensionStatus', junk.extension_status,
    'removedRequests', jsonb_agg(
      jsonb_build_object(
        'id', junk.id,
        'clientId', junk.client_id,
        'userId', junk.user_id,
        'requestedExtension', junk.requested_extension,
        'createdAt', junk.created_at,
        'updatedAt', junk.updated_at
      )
      ORDER BY junk.id
    )
  )
FROM junk
GROUP BY junk.plan_id, junk.agreement_id, junk.extension_status;

DELETE FROM plan_extension_requests
WHERE (client_id IS NULL OR client_id = '')
  AND requested_extension IS NULL;

WITH zeroed AS (
  SELECT p.id, p.agreement_id, p.extension_required_votes, p.extension_received_votes
  FROM plan p
  WHERE p.extension_status = 1
    AND NOT EXISTS (SELECT 1 FROM client_agreement ca WHERE ca.agreement_id = p.agreement_id)
    AND (p.extension_required_votes IS DISTINCT FROM 0 OR p.extension_received_votes IS DISTINCT FROM 0)
)
INSERT INTO audit_log (user_id, method, path, status_code, success, action, entity_type, entity_id, agreement_id, metadata)
SELECT
  1115,
  'SYSTEM',
  'migration.cleanup_null_client_extension_requests',
  200,
  true,
  'plan.updated',
  'plan',
  zeroed.id::text,
  zeroed.agreement_id,
  jsonb_build_object(
    'reason', 'extension_counters_zeroed_no_clients',
    'extensionRequiredVotes', jsonb_build_object('from', zeroed.extension_required_votes, 'to', 0),
    'extensionReceivedVotes', jsonb_build_object('from', zeroed.extension_received_votes, 'to', 0)
  )
FROM zeroed;

UPDATE plan p
SET extension_required_votes = 0,
    extension_received_votes = 0
WHERE p.extension_status = 1
  AND NOT EXISTS (SELECT 1 FROM client_agreement ca WHERE ca.agreement_id = p.agreement_id)
  AND (p.extension_required_votes IS DISTINCT FROM 0 OR p.extension_received_votes IS DISTINCT FROM 0);

-- migrate:down
-- Not reversible: removed requests and previous counter values are
-- snapshotted in audit_log under
-- path = 'migration.cleanup_null_client_extension_requests'.
SELECT 1;
