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
  pasture: { id: 1, plan_id: 1, name: 'Test Pasture' },
  plantCommunity: {
    id: 1,
    pasture_id: 1,
    community_type_id: 1,
    purpose_of_action: 'establish',
    name: 'Test Community',
  },
  monitoringArea: { id: 1, plant_community_id: 1, name: 'Test Area' },
  monitoringAreaPurpose: { id: 1, monitoring_area_id: 1, purpose_type_id: 1 },
};

describe('PlanPastureController.destroyMonitoringArea() transaction', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.canAccessAgreement = () => true;
  });

  beforeEach(async () => {
    await db.schema.raw(truncate('monitoring_area_purpose'));
    await db.schema.raw(truncate('monitoring_area'));
    await db.schema.raw(truncate('plant_community'));
    await db.schema.raw(truncate('pasture'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('agreement'));
    await db.schema.raw(truncate('ref_zone'));
    await db.schema.raw(truncate('ref_district'));
    await db.schema.raw(truncate('user_account'));

    await db('user_account').insert([seedData.user]);
    await db('ref_district').insert([seedData.district]);
    await db('ref_zone').insert([seedData.zone]);
    await db('agreement').insert([seedData.agreement]);
    await db('plan').insert([seedData.plan]);
    await db('pasture').insert([seedData.pasture]);
    await db('plant_community').insert([seedData.plantCommunity]);
    await db('monitoring_area').insert([seedData.monitoringArea]);
    await db('monitoring_area_purpose').insert([seedData.monitoringAreaPurpose]);
  });

  test('deletes a monitoring area and its purposes on valid DELETE', async () => {
    const app = await createApp();

    await request(app).delete(`${baseUrl}/1/pasture/1/plant-community/1/monitoring-area/1`).expect(204);

    const areas = await db.selectFrom('monitoring_area').selectAll().execute();
    expect(areas).toHaveLength(0);

    const purposes = await db.selectFrom('monitoring_area_purpose').selectAll().execute();
    expect(purposes).toHaveLength(0);
  });

  test('returns 500 and rolls back all writes when deletion fails', async () => {
    await db.schema.raw(`
      CREATE OR REPLACE FUNCTION test_block_monitoring_area_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'test: blocked monitoring area delete';
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.schema.raw(`
      CREATE TRIGGER test_block_monitoring_area_delete_trigger
      BEFORE DELETE ON monitoring_area
      FOR EACH ROW EXECUTE FUNCTION test_block_monitoring_area_delete()
    `);

    try {
      const app = await createApp();

      await request(app).delete(`${baseUrl}/1/pasture/1/plant-community/1/monitoring-area/1`).expect(500);

      const areas = await db.selectFrom('monitoring_area').selectAll().execute();
      expect(areas).toHaveLength(1);
      expect(areas[0].name).toBe('Test Area');

      const purposes = await db.selectFrom('monitoring_area_purpose').selectAll().execute();
      expect(purposes).toHaveLength(1);
    } finally {
      await db.schema.raw('DROP TRIGGER IF EXISTS test_block_monitoring_area_delete_trigger ON monitoring_area');
      await db.schema.raw('DROP FUNCTION IF EXISTS test_block_monitoring_area_delete');
    }
  });
});
