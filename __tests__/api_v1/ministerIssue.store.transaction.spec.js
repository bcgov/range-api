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
  plan: {
    id: 1,
    agreement_id: 'RAN076843',
    status_id: 1,
    creator_id: 1,
    range_name: 'Test Plan',
    uploaded: true,
    plan_start_date: '2026-01-01T08:00:00.000Z',
    plan_end_date: '2030-12-31T08:00:00.000Z',
  },
  pasture1: { id: 1, plan_id: 1, name: 'Test Pasture 1' },
  pasture2: { id: 2, plan_id: 1, name: 'Test Pasture 2' },
};

describe('PlanMinisterIssueController.store() transaction', () => {
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
    await db.schema.raw(truncate('agreement'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('pasture'));
    await db.schema.raw(truncate('minister_issue'));
    await db.schema.raw(truncate('minister_issue_pasture'));

    await db('user_account').insert([seedData.user]);
    await db('ref_district').insert([seedData.district]);
    await db('ref_zone').insert([seedData.zone]);
    await db('agreement').insert([seedData.agreement]);
    await db('plan').insert([seedData.plan]);
    await db('pasture').insert([seedData.pasture1]);
    await db('pasture').insert([seedData.pasture2]);
  });

  test('creates a minister issue and pasture links on valid POST', async () => {
    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/1/issue`)
      .send({ issueTypeId: 1, detail: 'Test issue', pastures: [1, 2] })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.detail).toBe('Test issue');
      });

    const issues = await db.selectFrom('minister_issue').selectAll().execute();
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toBe('Test issue');
    expect(issues[0].issue_type_id).toBe(1);

    const pastureLinks = await db.selectFrom('minister_issue_pasture').selectAll().execute();
    expect(pastureLinks).toHaveLength(2);
  });

  test('returns 500 and rolls back on FK constraint violation', async () => {
    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/1/issue`)
      .send({ issueTypeId: 99999, detail: 'Invalid issue', pastures: [1, 2] })
      .expect(500);

    const issues = await db.selectFrom('minister_issue').selectAll().execute();
    expect(issues).toHaveLength(0);

    const pastureLinks = await db.selectFrom('minister_issue_pasture').selectAll().execute();
    expect(pastureLinks).toHaveLength(0);
  });
});
