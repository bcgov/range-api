import path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import DataManager from '../../src/libs/db2/index.js';
import config from '../../src/config/index.js';
import { SqlFileMigrationProvider } from '../../src/libs/db2/migrate.js';

const dm = new DataManager(config);
const { db } = dm;

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/libs/db2/migrations');
const AUDIT_LOG_MIGRATION = '20261022120000_create_audit_log.sql';
const CLEANUP_MIGRATION = '20261120120000_cleanup_null_client_extension_requests.sql';
const AUDIT_PATH = 'migration.cleanup_null_client_extension_requests';

const PLAN_AWAITING_NO_CLIENTS = 910001;
const PLAN_REPLACED_NO_CLIENTS = 910002;
const PLAN_AWAITING_WITH_CLIENT = 910003;
const PLAN_AWAITING_ALREADY_ZERO = 910004;
const PLAN_IDS = [
  PLAN_AWAITING_NO_CLIENTS,
  PLAN_REPLACED_NO_CLIENTS,
  PLAN_AWAITING_WITH_CLIENT,
  PLAN_AWAITING_ALREADY_ZERO,
];
const AGREEMENT_NO_CLIENTS = 'RAN910001';
const AGREEMENT_WITH_CLIENT = 'RAN910002';
const AGREEMENT_IDS = [AGREEMENT_NO_CLIENTS, AGREEMENT_WITH_CLIENT];
const DISTRICT_ID = 910001;
const ZONE_ID = 910001;
const USER_CREATOR = 910001;
const USER_OWNER = 910002;
const USER_IDS = [USER_CREATOR, USER_OWNER];
const CLIENT_ID = 'T910001';

const runMigrationUp = async (name) => {
  const migrations = await new SqlFileMigrationProvider({ migrationFolder: MIGRATIONS_DIR }).getMigrations();
  await migrations[name].up(db);
};

const cleanup = async () => {
  await db.deleteFrom('plan_extension_requests').where('plan_id', 'in', PLAN_IDS).execute();
  await db.deleteFrom('client_agreement').where('agreement_id', 'in', AGREEMENT_IDS).execute();
  await db.deleteFrom('plan').where('id', 'in', PLAN_IDS).execute();
  await db.deleteFrom('agreement').where('forest_file_id', 'in', AGREEMENT_IDS).execute();
  await db.deleteFrom('user_client_link').where('user_id', 'in', USER_IDS).execute();
  await db.deleteFrom('ref_zone').where('id', '=', ZONE_ID).execute();
  await db.deleteFrom('ref_district').where('id', '=', DISTRICT_ID).execute();
  await db.deleteFrom('ref_client').where('client_number', '=', CLIENT_ID).execute();
  await db.deleteFrom('user_account').where('id', 'in', USER_IDS).execute();
  await db
    .deleteFrom('audit_log')
    .where('path', '=', AUDIT_PATH)
    .where(
      'entity_id',
      'in',
      PLAN_IDS.map((id) => String(id)),
    )
    .execute();
};

const insertRequest = async (planId, clientId, userId, requestedExtension) => {
  const row = await db
    .insertInto('plan_extension_requests')
    .values({
      plan_id: planId,
      client_id: clientId,
      user_id: userId,
      email: userId ? `user${userId}@test.ca` : null,
      requested_extension: requestedExtension,
    })
    .returning('id')
    .executeTakeFirst();
  return row.id;
};

const insertPlan = (id, agreementId, extensionStatus, requiredVotes, receivedVotes) =>
  db
    .insertInto('plan')
    .values({
      id,
      agreement_id: agreementId,
      status_id: 20,
      amendment_type_id: null,
      creator_id: USER_CREATOR,
      range_name: 'Test Range',
      extension_status: extensionStatus,
      extension_required_votes: requiredVotes,
      extension_received_votes: receivedVotes,
    })
    .execute();

const seed = async () => {
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
    .values({ client_number: CLIENT_ID, name: `Test Client ${CLIENT_ID}`, forest_file_client_type_code: 'A' })
    .execute();

  await db
    .insertInto('ref_district')
    .values({ id: DISTRICT_ID, code: 'TSU', description: 'Test District', user_id: USER_CREATOR })
    .execute();

  await db
    .insertInto('ref_zone')
    .values({ id: ZONE_ID, code: 'TSU', description: 'Test Zone', district_id: DISTRICT_ID, user_id: USER_CREATOR })
    .execute();

  await db
    .insertInto('agreement')
    .values(
      AGREEMENT_IDS.map((forestFileId) => ({
        forest_file_id: forestFileId,
        agreement_start_date: new Date('2020-01-01T00:00:00.000Z'),
        agreement_end_date: new Date('2030-01-01T00:00:00.000Z'),
        agreement_type_id: 1,
        zone_id: ZONE_ID,
        retired: false,
        exemption_status: 'NOT_EXEMPTED',
      })),
    )
    .execute();

  await db
    .insertInto('client_agreement')
    .values({ agreement_id: AGREEMENT_WITH_CLIENT, client_id: CLIENT_ID, client_type_id: 1 })
    .execute();

  await db
    .insertInto('user_client_link')
    .values({ user_id: USER_OWNER, client_id: CLIENT_ID, active: true, type: 'owner' })
    .execute();

  await insertPlan(PLAN_AWAITING_NO_CLIENTS, AGREEMENT_NO_CLIENTS, 1, 1, 0);
  await insertPlan(PLAN_REPLACED_NO_CLIENTS, AGREEMENT_NO_CLIENTS, 11, 1, 0);
  await insertPlan(PLAN_AWAITING_WITH_CLIENT, AGREEMENT_WITH_CLIENT, 1, 1, 0);
  await insertPlan(PLAN_AWAITING_ALREADY_ZERO, AGREEMENT_NO_CLIENTS, 1, 0, 0);

  return {
    awaitingJunkId: await insertRequest(PLAN_AWAITING_NO_CLIENTS, null, null, null),
    replacedJunkId: await insertRequest(PLAN_REPLACED_NO_CLIENTS, null, null, null),
    withClientJunkId: await insertRequest(PLAN_AWAITING_WITH_CLIENT, null, null, null),
    withClientValidId: await insertRequest(PLAN_AWAITING_WITH_CLIENT, CLIENT_ID, USER_OWNER, null),
    withClientCastNullId: await insertRequest(PLAN_AWAITING_WITH_CLIENT, null, null, true),
  };
};

const fetchPlan = (id) => db.selectFrom('plan').selectAll().where('id', '=', id).executeTakeFirst();

const fetchRequestIds = async (planId) =>
  (
    await db.selectFrom('plan_extension_requests').select('id').where('plan_id', '=', planId).orderBy('id').execute()
  ).map((row) => row.id);

const fetchAudit = (planId) =>
  db
    .selectFrom('audit_log')
    .selectAll()
    .where('path', '=', AUDIT_PATH)
    .where('entity_id', '=', String(planId))
    .orderBy('id')
    .execute();

describe('migration: cleanup null-client extension requests', () => {
  let ids;

  beforeAll(async () => {
    await runMigrationUp(AUDIT_LOG_MIGRATION);
  });

  beforeEach(async () => {
    await cleanup();
    ids = await seed();
    await runMigrationUp(CLEANUP_MIGRATION);
  });

  afterAll(cleanup);

  it('removes the junk request and zeroes counters for an awaiting-vote plan with no clients', async () => {
    expect(await fetchRequestIds(PLAN_AWAITING_NO_CLIENTS)).toEqual([]);

    const plan = await fetchPlan(PLAN_AWAITING_NO_CLIENTS);
    expect(plan.extension_required_votes).toBe(0);
    expect(plan.extension_received_votes).toBe(0);

    const audit = await fetchAudit(PLAN_AWAITING_NO_CLIENTS);
    expect(audit.map((row) => row.metadata.reason)).toEqual([
      'extension_requests_cleaned',
      'extension_counters_zeroed_no_clients',
    ]);
    expect(audit[0].metadata.removedRequests.map((request) => request.id)).toEqual([ids.awaitingJunkId]);
    expect(audit[1].metadata.extensionRequiredVotes).toEqual({ from: 1, to: 0 });
    expect(audit[1].metadata.extensionReceivedVotes).toEqual({ from: 0, to: 0 });
  });

  it('removes the junk request but keeps counters on a replaced plan', async () => {
    expect(await fetchRequestIds(PLAN_REPLACED_NO_CLIENTS)).toEqual([]);

    const plan = await fetchPlan(PLAN_REPLACED_NO_CLIENTS);
    expect(plan.extension_required_votes).toBe(1);
    expect(plan.extension_received_votes).toBe(0);

    const audit = await fetchAudit(PLAN_REPLACED_NO_CLIENTS);
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata.reason).toBe('extension_requests_cleaned');
    expect(audit[0].metadata.extensionStatus).toBe(11);
  });

  it('keeps valid requests, cast votes and counters on a plan whose agreement has clients', async () => {
    expect(await fetchRequestIds(PLAN_AWAITING_WITH_CLIENT)).toEqual([ids.withClientValidId, ids.withClientCastNullId]);

    const plan = await fetchPlan(PLAN_AWAITING_WITH_CLIENT);
    expect(plan.extension_required_votes).toBe(1);
    expect(plan.extension_received_votes).toBe(0);

    const audit = await fetchAudit(PLAN_AWAITING_WITH_CLIENT);
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata.removedRequests.map((request) => request.id)).toEqual([ids.withClientJunkId]);
  });

  it('writes nothing for an awaiting-vote plan that is already 0/0', async () => {
    const plan = await fetchPlan(PLAN_AWAITING_ALREADY_ZERO);
    expect(plan.extension_required_votes).toBe(0);
    expect(plan.extension_received_votes).toBe(0);
    expect(await fetchAudit(PLAN_AWAITING_ALREADY_ZERO)).toEqual([]);
  });
});
