vi.mock('passport');
import { default as request } from 'supertest';
import passport from 'passport';
import createApp from '../../src';
import DataManager from '../../src/libs/db2';
import config from '../../src/config';

const dm = new DataManager(config);
const { db } = dm;

const truncate = (table) => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;

const baseUrl = '/api/v1/plan';

const seedData = {
  user: {
    id: 1,
    username: 'admin',
    given_name: 'Range',
    family_name: 'Admin',
    email: 'admin@test.ca',
    active: true,
    pia_seen: false,
  },
  district: { id: 1, code: 'TST', description: 'Test District' },
  zone: { id: 1, code: 'TEST1', description: 'Test Zone', district_id: 1, user_id: 1 },
  agreement: {
    forest_file_id: 'RAN076843',
    agreement_start_date: '2017-01-01',
    agreement_end_date: '2041-12-31',
    agreement_type_id: 1,
    zone_id: 1,
  },
};

const validPlanBody = {
  rangeName: 'Transaction Test Plan',
  planStartDate: '2026-01-01T08:00:00.000Z',
  planEndDate: '2030-12-31T08:00:00.000Z',
  agreementId: 'RAN076843',
  uploaded: true,
  statusId: 6,
};

describe('PlanController.store() transaction', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.canAccessAgreement = () => true;
  });

  beforeEach(async () => {
    await db.schema.raw(truncate('user_account'));
    await db.schema.raw(truncate('ref_district'));
    await db.schema.raw(truncate('ref_zone'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('plan_confirmation'));
    await db.schema.raw(truncate('agreement'));

    await db('user_account').insert([seedData.user]);
    await db('ref_district').insert([seedData.district]);
    await db('ref_zone').insert([seedData.zone]);
    await db('agreement').insert([seedData.agreement]);
  });

  test('creates a plan and confirmations on valid POST', async () => {
    const app = await createApp();

    await request(app)
      .post(baseUrl)
      .send(validPlanBody)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.rangeName).toBe('Transaction Test Plan');
        expect(res.body.agreementId).toBe('RAN076843');
      });

    const plans = await db.selectFrom('plan').selectAll().execute();
    expect(plans).toHaveLength(1);
    expect(plans[0].range_name).toBe('Transaction Test Plan');
  });

  test('removes existing staff draft and creates new plan', async () => {
    const staffDraftPlan = {
      range_name: 'Old Draft',
      plan_start_date: '2020-01-01',
      plan_end_date: '2025-12-31',
      agreement_id: 'RAN076843',
      status_id: 6,
      creator_id: 1,
      uploaded: true,
    };
    await db('plan').insert([staffDraftPlan]);

    const app = await createApp();

    await request(app).post(baseUrl).send(validPlanBody).expect(200);

    const plans = await db.selectFrom('plan').selectAll().execute();
    expect(plans).toHaveLength(1);
    expect(plans[0].range_name).toBe('Transaction Test Plan');
  });

  test('returns 500 and rolls back all writes on constraint violation', async () => {
    const initialPlans = await db.selectFrom('plan').selectAll().execute();
    expect(initialPlans).toHaveLength(0);

    const invalidBody = { agreementId: 'RAN076843', uploaded: true, statusId: 6 };

    const app = await createApp();

    await request(app).post(baseUrl).send(invalidBody).expect(500);

    const plansAfter = await db.selectFrom('plan').selectAll().execute();
    expect(plansAfter).toHaveLength(0);

    const confirmationsAfter = await db.selectFrom('plan_confirmation').selectAll().execute();
    expect(confirmationsAfter).toHaveLength(0);
  });

  test('returns 500 and rolls back when staff draft is deleted but creation fails', async () => {
    const staffDraftPlan = {
      range_name: 'Draft to Delete',
      plan_start_date: '2020-01-01',
      plan_end_date: '2025-12-31',
      agreement_id: 'RAN076843',
      status_id: 6,
      creator_id: 1,
      uploaded: true,
    };
    await db('plan').insert([staffDraftPlan]);

    const initialPlans = await db.selectFrom('plan').selectAll().execute();
    expect(initialPlans).toHaveLength(1);
    expect(initialPlans[0].range_name).toBe('Draft to Delete');

    const invalidBody = { agreementId: 'RAN076843', uploaded: true, statusId: 6 };

    const app = await createApp();

    await request(app).post(baseUrl).send(invalidBody).expect(500);

    const plansAfter = await db.selectFrom('plan').selectAll().execute();
    expect(plansAfter).toHaveLength(1);
    expect(plansAfter[0].range_name).toBe('Draft to Delete');
  });
});
