import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import DataManager from '../../src/libs/db2/index.js';
import config from '../../src/config/index.js';
import Agreement from '../../src/libs/db2/model/agreement.js';
import NotificationHelper from '../../src/router/helpers/NotificationHelper.js';
import { reconcilePlanExtensionVoters } from '../../src/router/helpers/PlanExtensionHelper.js';
import PlanExtensionController from '../../src/router/controllers_v1/PlanExtensionController.js';

const dm = new DataManager(config);
const { db } = dm;

const PLAN_ID = 900001;
const AGREEMENT_ID = 'RAN900001';
const DISTRICT_ID = 900001;
const ZONE_ID = 900001;
const USER_CREATOR = 900001;
const USER_OWNER_A = 900002;
const USER_OWNER_B = 900003;
const USER_OWNER_C = 900004;
const USER_OLD = 900005;
const USER_ZONE = 900006;
const USER_IDS = [USER_CREATOR, USER_OWNER_A, USER_OWNER_B, USER_OWNER_C, USER_OLD, USER_ZONE];
const CLIENT_A = 'T900001';
const CLIENT_B = 'T900002';
const CLIENT_C = 'T900003';
const CLIENT_OBSOLETE = 'T900009';
const CLIENT_IDS = [CLIENT_A, CLIENT_B, CLIENT_C, CLIENT_OBSOLETE];

const cleanup = async () => {
  await db.deleteFrom('plan_extension_requests').where('plan_id', '=', PLAN_ID).execute();
  await db.deleteFrom('client_agreement').where('agreement_id', '=', AGREEMENT_ID).execute();
  await db.deleteFrom('plan').where('id', '=', PLAN_ID).execute();
  await db.deleteFrom('agreement').where('forest_file_id', '=', AGREEMENT_ID).execute();
  await db.deleteFrom('user_client_link').where('user_id', 'in', USER_IDS).execute();
  await db.deleteFrom('ref_zone').where('id', '=', ZONE_ID).execute();
  await db.deleteFrom('ref_district').where('id', '=', DISTRICT_ID).execute();
  await db.deleteFrom('ref_client').where('client_number', 'in', CLIENT_IDS).execute();
  await db.deleteFrom('user_account').where('id', 'in', USER_IDS).execute();
};

const insertRequest = async (clientId, userId, requestedExtension) => {
  const row = await db
    .insertInto('plan_extension_requests')
    .values({
      plan_id: PLAN_ID,
      client_id: clientId,
      user_id: userId,
      email: `user${userId}@test.ca`,
      requested_extension: requestedExtension,
    })
    .returning('id')
    .executeTakeFirst();
  return row.id;
};

const seedBase = async () => {
  await db
    .insertInto('user_account')
    .values(
      USER_IDS.map((id) => ({
        id,
        username: `test-user-${id}`,
        email: `user${id}@test.ca`,
        active: true,
        pia_seen: false,
      })),
    )
    .execute();

  await db
    .insertInto('ref_client')
    .values(
      CLIENT_IDS.map((clientNumber) => ({
        client_number: clientNumber,
        name: `Test Client ${clientNumber}`,
        forest_file_client_type_code: 'A',
      })),
    )
    .execute();

  await db
    .insertInto('ref_district')
    .values({ id: DISTRICT_ID, code: 'TST', description: 'Test District', user_id: USER_ZONE })
    .execute();

  await db
    .insertInto('ref_zone')
    .values({ id: ZONE_ID, code: 'TST', description: 'Test Zone', district_id: DISTRICT_ID, user_id: USER_ZONE })
    .execute();

  await db
    .insertInto('agreement')
    .values({
      forest_file_id: AGREEMENT_ID,
      agreement_start_date: new Date('2020-01-01T00:00:00.000Z'),
      agreement_end_date: new Date('2030-01-01T00:00:00.000Z'),
      agreement_type_id: 1,
      zone_id: ZONE_ID,
      retired: false,
      exemption_status: 'NOT_EXEMPTED',
    })
    .execute();

  await db
    .insertInto('plan')
    .values({
      id: PLAN_ID,
      agreement_id: AGREEMENT_ID,
      status_id: 20,
      amendment_type_id: null,
      creator_id: USER_CREATOR,
      range_name: 'Test Range',
      extension_status: 1,
      extension_required_votes: 3,
      extension_received_votes: 2,
    })
    .execute();

  await db
    .insertInto('client_agreement')
    .values(
      [CLIENT_A, CLIENT_B, CLIENT_C].map((clientId) => ({
        agreement_id: AGREEMENT_ID,
        client_id: clientId,
        client_type_id: 1,
      })),
    )
    .execute();

  await db
    .insertInto('user_client_link')
    .values([
      { user_id: USER_OWNER_A, client_id: CLIENT_A, active: true, type: 'owner' },
      { user_id: USER_OWNER_B, client_id: CLIENT_B, active: true, type: 'owner' },
      { user_id: USER_OWNER_C, client_id: CLIENT_C, active: true, type: 'owner' },
    ])
    .execute();

  await insertRequest(CLIENT_A, USER_OWNER_A, true);
  await insertRequest(CLIENT_B, USER_OWNER_B, true);
  const staleClientRequestId = await insertRequest(CLIENT_C, USER_OLD, null);
  await insertRequest(CLIENT_OBSOLETE, USER_OLD, null);

  return { staleClientRequestId };
};

describe('plan extension voter roster reconciliation', () => {
  beforeAll(cleanup);

  beforeEach(async () => {
    await cleanup();
    await seedBase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  afterAll(cleanup);

  it('replaces an obsolete pending voter with the current client and preserves cast votes', async () => {
    const result = await reconcilePlanExtensionVoters(db, PLAN_ID);

    expect(result.status).toBe('reconciled');
    expect(result.currentClientIds).toEqual([CLIENT_A, CLIENT_B, CLIENT_C]);
    expect(result.extensionRequiredVotes).toBe(3);
    expect(result.extensionReceivedVotes).toBe(2);

    const requests = await db
      .selectFrom('plan_extension_requests')
      .selectAll()
      .where('plan_id', '=', PLAN_ID)
      .orderBy('client_id', 'asc')
      .execute();

    expect(requests.map((request) => request.client_id)).toEqual([CLIENT_A, CLIENT_B, CLIENT_C]);

    const currentClientRequest = requests.find((request) => request.client_id === CLIENT_C);
    expect(currentClientRequest.user_id).toBe(USER_OWNER_C);
    expect(currentClientRequest.requested_extension).toBeNull();

    const approvedRequests = requests.filter((request) => request.requested_extension === true);
    expect(approvedRequests.map((request) => request.client_id)).toEqual([CLIENT_A, CLIENT_B]);

    const plan = await db.selectFrom('plan').selectAll().where('id', '=', PLAN_ID).executeTakeFirst();
    expect(plan.extension_required_votes).toBe(3);
    expect(plan.extension_received_votes).toBe(2);
  });

  it('is idempotent and collapses duplicate requests without losing votes', async () => {
    await insertRequest(CLIENT_A, USER_OWNER_A, true);
    await insertRequest(CLIENT_C, USER_OLD, null);
    await insertRequest(CLIENT_OBSOLETE, USER_OLD, true);

    const first = await reconcilePlanExtensionVoters(db, PLAN_ID);
    expect(first.status).toBe('reconciled');
    expect(first.addedRequests).toHaveLength(0);
    expect(first.removedRequests.length).toBeGreaterThan(0);

    const firstRows = await db
      .selectFrom('plan_extension_requests')
      .selectAll()
      .where('plan_id', '=', PLAN_ID)
      .orderBy('id', 'asc')
      .execute();
    expect(firstRows.map((request) => request.client_id).sort()).toEqual([CLIENT_A, CLIENT_B, CLIENT_C].sort());

    const plan = await db.selectFrom('plan').selectAll().where('id', '=', PLAN_ID).executeTakeFirst();
    expect(plan.extension_required_votes).toBe(3);
    expect(plan.extension_received_votes).toBe(2);

    const second = await reconcilePlanExtensionVoters(db, PLAN_ID);
    expect(second.status).toBe('unchanged');
    expect(second.addedRequests).toEqual([]);
    expect(second.removedRequests).toEqual([]);
    expect(second.updatedRequests).toEqual([]);

    const secondRows = await db
      .selectFrom('plan_extension_requests')
      .selectAll()
      .where('plan_id', '=', PLAN_ID)
      .orderBy('id', 'asc')
      .execute();
    expect(secondRows).toEqual(firstRows);
  });

  it('lets the current holder cast the final vote while an obsolete request cannot block completion', async () => {
    const staleClientRequest = await db
      .selectFrom('plan_extension_requests')
      .select('id')
      .where('plan_id', '=', PLAN_ID)
      .where('client_id', '=', CLIENT_C)
      .executeTakeFirst();
    const staleClientRequestId = staleClientRequest.id;

    vi.spyOn(Agreement, 'findWithTypeZoneDistrictExemption').mockResolvedValue([
      { zone: { user: { email: 'zone.owner@test.ca' } } },
    ]);
    const sendEmail = vi.spyOn(NotificationHelper, 'sendEmail').mockResolvedValue(undefined);

    const req = {
      params: { planId: String(PLAN_ID) },
      body: { extensionRequestId: staleClientRequestId },
      user: {
        id: USER_OWNER_C,
        roleId: 1,
        agentOf: [],
        isAgreementHolder: () => true,
      },
      method: 'PUT',
      originalUrl: `/api/v1/plan/${PLAN_ID}/extension/approve`,
      route: { path: '/:planId/extension/approve' },
      auditRequestId: 'req-1',
      auditCorrelationId: 'corr-1',
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await PlanExtensionController.approveExtension(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const currentClientRequest = await db
      .selectFrom('plan_extension_requests')
      .selectAll()
      .where('plan_id', '=', PLAN_ID)
      .where('client_id', '=', CLIENT_C)
      .executeTakeFirst();
    expect(currentClientRequest.user_id).toBe(USER_OWNER_C);
    expect(currentClientRequest.requested_extension).toBe(true);

    const obsoleteRequest = await db
      .selectFrom('plan_extension_requests')
      .selectAll()
      .where('plan_id', '=', PLAN_ID)
      .where('client_id', '=', CLIENT_OBSOLETE)
      .executeTakeFirst();
    expect(obsoleteRequest).toBeUndefined();

    const plan = await db.selectFrom('plan').selectAll().where('id', '=', PLAN_ID).executeTakeFirst();
    expect(plan.extension_required_votes).toBe(3);
    expect(plan.extension_received_votes).toBe(3);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      ['zone.owner@test.ca'],
      'Plan Pending Extension',
      expect.anything(),
    );
  });
});
