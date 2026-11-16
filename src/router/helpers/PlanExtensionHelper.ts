// @ts-nocheck
'use strict';

import { PLAN_EXTENSION_STATUS, SYSTEM_USER_ID } from '../../constants.js';
import { writeDomainAudit } from '../../libs/audit.js';
import ClientAgreement from '../../libs/db2/model/ClientAgreement.js';
import Plan from '../../libs/db2/model/plan.js';
import PlanExtensionRequests from '../../libs/db2/model/planextensionrequests.js';

const DEFAULT_AUDIT_CONTEXT = {
  requestId: null,
  correlationId: null,
  userId: SYSTEM_USER_ID,
  roleId: null,
  method: 'SYSTEM',
  path: 'background_job.plan_extension_reconciliation',
  route: null,
};

const normalizeAuditContext = (context = {}) => ({
  ...DEFAULT_AUDIT_CONTEXT,
  ...context,
  userId: context.userId ?? SYSTEM_USER_ID,
});

const getCurrentClientIds = async (trx, agreementId) => {
  const clientAgreements = await ClientAgreement.find(trx, { agreement_id: agreementId });
  const clientIds = [];
  const seen = new Set();
  for (const clientAgreement of clientAgreements) {
    if (!clientAgreement.clientId || seen.has(clientAgreement.clientId)) continue;
    seen.add(clientAgreement.clientId);
    clientIds.push(clientAgreement.clientId);
  }
  return clientIds.sort();
};

/**
 * Current agreement clients requiring a vote, mapped to their active owner account.
 * Clients without an active owner still require a vote and get a pending request
 * with no user; linking an account later fills it in.
 */
const getActiveOwners = async (trx, clientIds) => {
  const owners = new Map();
  if (clientIds.length === 0) return owners;

  const rows = await trx
    .selectFrom('user_client_link as ucl')
    .leftJoin('user_account as ua', 'ua.id', 'ucl.user_id')
    .select(['ucl.id as link_id', 'ucl.client_id', 'ua.id as user_id', 'ua.email'])
    .where('ucl.client_id', 'in', clientIds)
    .where('ucl.active', '=', true)
    .where('ucl.type', '=', 'owner')
    .orderBy('ucl.id', 'asc')
    .execute();

  for (const row of rows) {
    if (!owners.has(row.client_id)) {
      owners.set(row.client_id, {
        userId: row.user_id ?? null,
        email: row.email ?? null,
      });
    }
  }
  return owners;
};

const requestTimestamp = (request) => {
  const value = request.updatedAt || request.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/**
 * Pick the request that represents a client's vote.
 *
 * A cast vote always wins over pending duplicates. When several cast votes exist for
 * the same client, the most recently updated one is kept (no consent is transferred or
 * fabricated). Pending duplicates prefer the request already assigned to the current
 * owner, then the oldest request.
 */
const pickCanonicalRequest = (requests, owner) => {
  const castRequests = requests.filter((request) => request.requestedExtension !== null);
  if (castRequests.length > 0) {
    return castRequests.slice().sort((a, b) => {
      const timestampDelta = requestTimestamp(b) - requestTimestamp(a);
      if (timestampDelta !== 0) return timestampDelta;
      return b.id - a.id;
    })[0];
  }

  if (owner && owner.userId !== null) {
    const assigned = requests.find((request) => request.userId === owner.userId);
    if (assigned) return assigned;
  }

  return requests.slice().sort((a, b) => a.id - b.id)[0];
};

const requestAuditValues = (request, reason) => ({
  id: request.id,
  clientId: request.clientId,
  userId: request.userId,
  requestedExtension: request.requestedExtension,
  reason,
});

/**
 * Reconcile an active extension vote with the agreement's current client roster.
 *
 * Business rule:
 * - Every current `client_agreement` client requires exactly one request/vote.
 * - A current client with no request gets a pending request assigned to its active owner.
 * - A pending request for a current client is reassigned when the owner account changes.
 * - Requests for clients no longer on the agreement are removed; their votes no longer count.
 * - Cast votes for current clients are preserved and never transferred to another client.
 * - Required/received counters are derived from the current roster and retained votes.
 *
 * The operation is idempotent: running it again with unchanged data writes nothing.
 */
export const reconcilePlanExtensionVoters = async (trx, planId, auditContext = {}) => {
  const plan = await Plan.findOne(trx, { id: planId });
  if (!plan) {
    return { planId, status: 'skipped', reason: 'plan_not_found' };
  }
  if (plan.extensionStatus !== PLAN_EXTENSION_STATUS.AWAITING_VOTES) {
    return { planId, status: 'skipped', reason: 'not_awaiting_votes' };
  }

  const currentClientIds = await getCurrentClientIds(trx, plan.agreementId);
  if (currentClientIds.length === 0) {
    return { planId, status: 'skipped', reason: 'no_current_clients' };
  }

  const currentClientIdSet = new Set(currentClientIds);
  const owners = await getActiveOwners(trx, currentClientIds);
  const requests = await PlanExtensionRequests.find(trx, { plan_id: plan.id }, ['id', 'asc']);

  const requestsByClient = new Map();
  const obsoleteRequests = [];
  for (const request of requests) {
    if (!request.clientId || !currentClientIdSet.has(request.clientId)) {
      obsoleteRequests.push(request);
      continue;
    }
    if (!requestsByClient.has(request.clientId)) {
      requestsByClient.set(request.clientId, []);
    }
    requestsByClient.get(request.clientId).push(request);
  }

  const addedRequests = [];
  const removedRequests = [];
  const updatedRequests = [];
  const retainedRequests = [];
  const context = normalizeAuditContext(auditContext);

  for (const request of obsoleteRequests) {
    await PlanExtensionRequests.removeById(trx, request.id);
    removedRequests.push(requestAuditValues(request, 'client_not_on_agreement'));
  }

  for (const clientId of currentClientIds) {
    const owner = owners.get(clientId) || { userId: null, email: null };
    const clientRequests = requestsByClient.get(clientId) || [];
    let retainedRequest = null;

    if (clientRequests.length > 0) {
      retainedRequest = pickCanonicalRequest(clientRequests, owner);
      for (const request of clientRequests) {
        if (request.id === retainedRequest.id) continue;
        await PlanExtensionRequests.removeById(trx, request.id);
        removedRequests.push(requestAuditValues(request, 'duplicate_request'));
      }
    }

    if (!retainedRequest) {
      retainedRequest = await PlanExtensionRequests.create(trx, {
        planId: plan.id,
        clientId,
        userId: owner.userId,
        email: owner.email,
      });
      addedRequests.push({
        id: retainedRequest.id,
        clientId,
        userId: owner.userId,
      });
    } else if (
      retainedRequest.requestedExtension === null &&
      (retainedRequest.userId !== owner.userId || retainedRequest.email !== owner.email)
    ) {
      await PlanExtensionRequests.update(
        trx,
        { id: retainedRequest.id },
        {
          userId: owner.userId,
          email: owner.email,
        },
      );
      updatedRequests.push({
        id: retainedRequest.id,
        clientId,
        fromUserId: retainedRequest.userId,
        toUserId: owner.userId,
      });
      retainedRequest = { ...retainedRequest, userId: owner.userId, email: owner.email };
    }

    retainedRequests.push(retainedRequest);
  }

  const extensionRequiredVotes = currentClientIds.length;
  const extensionReceivedVotes = retainedRequests.filter((request) => request.requestedExtension === true).length;
  const countersChanged =
    plan.extensionRequiredVotes !== extensionRequiredVotes || plan.extensionReceivedVotes !== extensionReceivedVotes;

  if (countersChanged) {
    await Plan.update(
      trx,
      { id: plan.id },
      {
        extensionRequiredVotes,
        extensionReceivedVotes,
      },
    );
  }

  const changed =
    addedRequests.length > 0 || removedRequests.length > 0 || updatedRequests.length > 0 || countersChanged;

  if (changed) {
    await writeDomainAudit(trx, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      userId: context.userId,
      roleId: context.roleId,
      method: context.method,
      path: context.path,
      route: context.route,
      action: 'plan.updated',
      entityType: 'plan',
      entityId: plan.id,
      agreementId: plan.agreementId,
      metadata: {
        reason: 'extension_voter_roster_reconciled',
        currentClientIds,
        addedRequests,
        removedRequests,
        updatedRequests,
        extensionRequiredVotes: {
          from: plan.extensionRequiredVotes,
          to: extensionRequiredVotes,
        },
        extensionReceivedVotes: {
          from: plan.extensionReceivedVotes,
          to: extensionReceivedVotes,
        },
      },
    });
  }

  return {
    planId: plan.id,
    status: changed ? 'reconciled' : 'unchanged',
    currentClientIds,
    extensionRequiredVotes,
    extensionReceivedVotes,
    addedRequests,
    removedRequests,
    updatedRequests,
  };
};

export const reconcileAwaitingExtensionVoterRosters = async (trx, auditContext = {}) => {
  const plans = await trx
    .selectFrom('plan')
    .select('id')
    .where('extension_status', '=', PLAN_EXTENSION_STATUS.AWAITING_VOTES)
    .orderBy('id', 'asc')
    .execute();

  const results = [];
  for (const plan of plans) {
    results.push(await reconcilePlanExtensionVoters(trx, plan.id, auditContext));
  }
  return results;
};
