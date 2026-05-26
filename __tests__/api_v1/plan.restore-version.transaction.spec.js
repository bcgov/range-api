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

const seed = {
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
    exemption_status: 'NOT_EXEMPTED',
  },
};

describe('PlanVersionController.restoreVersion() transaction', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.canAccessAgreement = () => true;
  });

  beforeEach(async () => {
    await db.schema.raw(truncate('plan_file'));
    await db.schema.raw(truncate('plan_status_history'));
    await db.schema.raw(truncate('plan_confirmation'));
    await db.schema.raw(truncate('plan_snapshot'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('agreement'));
    await db.schema.raw(truncate('ref_zone'));
    await db.schema.raw(truncate('ref_district'));
    await db.schema.raw(truncate('user_account'));

    await db('user_account').insert([seed.user]);
    await db('ref_district').insert([seed.district]);
    await db('ref_zone').insert([seed.zone]);
    await db('agreement').insert([seed.agreement]);
  });

  test('restores version successfully', async () => {
    await db('plan').insert([
      {
        id: 1,
        agreement_id: 'RAN076843',
        range_name: 'Original Plan',
        plan_start_date: '2026-01-01T08:00:00.000Z',
        plan_end_date: '2030-12-31T08:00:00.000Z',
        status_id: 9,
        creator_id: 1,
        uploaded: true,
      },
    ]);

    const minimalSnapshot = {
      id: 1,
      range_name: 'Restored Plan Name',
      rangeName: 'Restored Plan Name',
      plan_start_date: '2026-01-01T08:00:00.000Z',
      planStartDate: '2026-01-01T08:00:00.000Z',
      plan_end_date: '2030-12-31T08:00:00.000Z',
      planEndDate: '2030-12-31T08:00:00.000Z',
      agreement_id: 'RAN076843',
      agreementId: 'RAN076843',
      status_id: 9,
      statusId: 9,
      creator_id: 1,
      creatorId: 1,
      uploaded: true,
      pastures: [],
      schedules: [],
      additionalRequirements: [],
      ministerIssues: [],
      managementConsiderations: [],
      confirmations: [],
      planStatusHistory: [],
      files: [],
      agreement: { agreementTypeId: 1, agreement_type_id: 1 },
    };

    await db('plan_snapshot').insert([
      {
        plan_id: 1,
        version: 1,
        status_id: 9,
        user_id: 1,
        snapshot: JSON.stringify(minimalSnapshot),
      },
    ]);

    const app = await createApp();

    await request(app).post(`${baseUrl}/1/version/1/restore`).expect(200);
  });

  test('rolls back all writes when restoreVersion fails', async () => {
    await db('plan').insert([
      {
        id: 1,
        agreement_id: 'RAN076843',
        range_name: 'Rollback Origin',
        plan_start_date: '2026-01-01T08:00:00.000Z',
        plan_end_date: '2030-12-31T08:00:00.000Z',
        status_id: 9,
        creator_id: 1,
        uploaded: true,
      },
    ]);

    const snapshotWithInvalidPasture = {
      id: 1,
      range_name: 'Should Not Persist',
      rangeName: 'Should Not Persist',
      plan_start_date: '2026-01-01T08:00:00.000Z',
      planStartDate: '2026-01-01T08:00:00.000Z',
      plan_end_date: '2030-12-31T08:00:00.000Z',
      planEndDate: '2030-12-31T08:00:00.000Z',
      agreement_id: 'RAN076843',
      agreementId: 'RAN076843',
      status_id: 9,
      statusId: 9,
      creator_id: 1,
      creatorId: 1,
      uploaded: true,
      pastures: [
        {
          id: 1,
          plan_id: 1,
          allowable_aum: 100,
        },
      ],
      schedules: [],
      additionalRequirements: [],
      ministerIssues: [],
      managementConsiderations: [],
      confirmations: [],
      planStatusHistory: [],
      files: [],
      agreement: { agreementTypeId: 1, agreement_type_id: 1 },
    };

    await db('plan_snapshot').insert([
      {
        plan_id: 1,
        version: 1,
        status_id: 9,
        user_id: 1,
        snapshot: JSON.stringify(snapshotWithInvalidPasture),
      },
    ]);

    const planBefore = await db.selectFrom('plan').selectAll().where('id', '=', 1).execute();
    expect(planBefore[0].range_name).toBe('Rollback Origin');

    const app = await createApp();

    await request(app).post(`${baseUrl}/1/version/1/restore`).expect(500);

    const planAfter = await db.selectFrom('plan').selectAll().where('id', '=', 1).execute();
    expect(planAfter[0].range_name).toBe('Rollback Origin');
    expect(planAfter[0].is_restored).not.toBe(true);

    const pasturesAfter = await db.selectFrom('pasture').selectAll().where('plan_id', '=', 1).execute();
    expect(pasturesAfter).toHaveLength(0);
  });
});
