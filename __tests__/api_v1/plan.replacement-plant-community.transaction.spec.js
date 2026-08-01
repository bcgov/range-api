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
  },
  plan: {
    id: 1,
    agreement_id: 'RAN076843',
    range_name: 'Source Plan',
    plan_start_date: '2019-01-21T08:00:00.000Z',
    plan_end_date: '2022-12-30T08:00:00.000Z',
    status_id: 26,
    creator_id: 1,
    uploaded: true,
  },
  pasture: {
    id: 1,
    plan_id: 1,
    name: 'Source Pasture',
    allowable_aum: 100,
    grace_days: 10,
    pld_percent: '0.62',
  },
  invasivePlantChecklist: {
    id: 1,
    plan_id: 1,
    equipment_and_vehicles_parking: false,
    begin_in_uninfested_area: false,
  },
};

describe('PlanController.duplicatePlan() plant community transfer (replacement plans)', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.canAccessAgreement = () => true;
  });

  beforeEach(async () => {
    await db.schema.raw(truncate('plan_snapshot'));
    await db.schema.raw(truncate('plan_status_history'));
    await db.schema.raw(truncate('plan_confirmation'));
    await db.schema.raw(truncate('plan_version'));
    await db.schema.raw(truncate('plan_file'));
    await db.schema.raw(truncate('monitoring_area_purpose'));
    await db.schema.raw(truncate('monitoring_area'));
    await db.schema.raw(truncate('indicator_plant'));
    await db.schema.raw(truncate('plant_community_action'));
    await db.schema.raw(truncate('plant_community'));
    await db.schema.raw(truncate('pasture'));
    await db.schema.raw(truncate('invasive_plant_checklist'));
    await db.schema.raw(truncate('additional_requirement'));
    await db.schema.raw(truncate('minister_issue_pasture'));
    await db.schema.raw(truncate('minister_issue_action'));
    await db.schema.raw(truncate('minister_issue'));
    await db.schema.raw(truncate('management_consideration'));
    await db.schema.raw(truncate('grazing_schedule_entry'));
    await db.schema.raw(truncate('grazing_schedule'));
    await db.schema.raw(truncate('client_agreement'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('agreement'));
    await db.schema.raw(truncate('ref_zone'));
    await db.schema.raw(truncate('ref_district'));
    await db.schema.raw(truncate('user_account'));

    await db('user_account').insert([seed.user]);
    await db('ref_district').insert([seed.district]);
    await db('ref_zone').insert([seed.zone]);
    await db('agreement').insert([seed.agreement]);
    await db('plan').insert([seed.plan]);
    await db('pasture').insert([seed.pasture]);
    await db('invasive_plant_checklist').insert([seed.invasivePlantChecklist]);

    // TRUNCATE ... RESTART IDENTITY resets sequences; move them far ahead so
    // auto-generated ids (new plan/pasture/communities) never collide with the seeded ids.
    // plan_version and agreement have no serial "id" column (composite / varchar PK).
    const truncatedTables = [
      'plan_snapshot',
      'plan_status_history',
      'plan_confirmation',
      'plan_file',
      'monitoring_area_purpose',
      'monitoring_area',
      'indicator_plant',
      'plant_community_action',
      'plant_community',
      'pasture',
      'invasive_plant_checklist',
      'additional_requirement',
      'minister_issue_pasture',
      'minister_issue_action',
      'minister_issue',
      'management_consideration',
      'grazing_schedule_entry',
      'grazing_schedule',
      'client_agreement',
      'plan',
    ];
    for (const table of truncatedTables) {
      await db.schema.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), 100000)`);
    }
  });

  const ensureRefRow = async (table, values) => {
    const existing = await db.selectFrom(table).selectAll().limit(1).execute();
    if (existing.length > 0) return existing[0].id;
    const inserted = await db.insertInto(table).values(values).returning('id').execute();
    return inserted[0].id;
  };

  test('transfers plant communities with all sub-children to the replacement plan', async () => {
    // Reference rows for the seeded plant community / children (may or may not be present)
    const communityTypeId = await ensureRefRow('ref_plant_community_type', {
      id: 1,
      name: 'Test Community Type',
      active: true,
    });
    const elevationId = await ensureRefRow('ref_plant_community_elevation', {
      id: 1,
      name: 'Test Elevation',
      active: true,
    });
    const plantSpeciesId = await ensureRefRow('ref_plant_species', {
      id: 1,
      name: 'Test Species',
      active: true,
      is_shrub_use: false,
    });
    const purposeTypeId = await ensureRefRow('ref_monitoring_area_purpose_type', {
      id: 1,
      name: 'Test Purpose',
      active: true,
    });
    const actionTypeId = await ensureRefRow('ref_plant_community_action_type', {
      id: 1,
      name: 'Test Action',
      active: true,
    });

    await db('plant_community').insert([
      {
        id: 1,
        pasture_id: 1,
        community_type_id: communityTypeId,
        elevation_id: elevationId,
        purpose_of_action: 'none',
        name: 'My Plant Community',
        aspect: 'aspect',
        notes: 'notes',
        range_readiness_day: 14,
        range_readiness_month: 4,
        approved: false,
        shrub_use: 0.8,
      },
    ]);
    await db('indicator_plant').insert([
      { id: 1, plant_community_id: 1, plant_species_id: plantSpeciesId, criteria: 'rangereadiness', value: 0.5 },
    ]);
    await db('monitoring_area').insert([{ id: 1, plant_community_id: 1, name: 'my area' }]);
    await db('monitoring_area_purpose').insert([{ id: 1, monitoring_area_id: 1, purpose_type_id: purposeTypeId }]);
    await db('plant_community_action').insert([{ id: 1, plant_community_id: 1, action_type_id: actionTypeId }]);

    const app = await createApp();
    await request(app).put(`${baseUrl}/1/extension/createReplacementPlan`).expect(200);

    const replacementPlans = await db.selectFrom('plan').selectAll().where('replacement_of', '=', 1).execute();
    expect(replacementPlans).toHaveLength(1);
    const replacementPlanId = replacementPlans[0].id;

    const replacementPastures = await db
      .selectFrom('pasture')
      .selectAll()
      .where('plan_id', '=', replacementPlanId)
      .execute();
    expect(replacementPastures).toHaveLength(1);
    const replacementPastureId = replacementPastures[0].id;
    expect(replacementPastureId).not.toBe(seed.pasture.id);

    const replacementCommunities = await db
      .selectFrom('plant_community')
      .selectAll()
      .where('pasture_id', '=', replacementPastureId)
      .execute();
    expect(replacementCommunities).toHaveLength(1);
    expect(replacementCommunities[0].name).toBe('My Plant Community');
    expect(replacementCommunities[0].community_type_id).toBe(communityTypeId);
    const newCommunityId = replacementCommunities[0].id;
    expect(newCommunityId).not.toBe(1);

    const indicatorPlants = await db
      .selectFrom('indicator_plant')
      .selectAll()
      .where('plant_community_id', '=', newCommunityId)
      .execute();
    expect(indicatorPlants).toHaveLength(1);
    expect(indicatorPlants[0].plant_species_id).toBe(plantSpeciesId);

    const monitoringAreas = await db
      .selectFrom('monitoring_area')
      .selectAll()
      .where('plant_community_id', '=', newCommunityId)
      .execute();
    expect(monitoringAreas).toHaveLength(1);
    const monitoringAreaPurposes = await db
      .selectFrom('monitoring_area_purpose')
      .selectAll()
      .where('monitoring_area_id', '=', monitoringAreas[0].id)
      .execute();
    expect(monitoringAreaPurposes).toHaveLength(1);
    expect(monitoringAreaPurposes[0].purpose_type_id).toBe(purposeTypeId);

    const actions = await db
      .selectFrom('plant_community_action')
      .selectAll()
      .where('plant_community_id', '=', newCommunityId)
      .execute();
    expect(actions).toHaveLength(1);
    expect(actions[0].action_type_id).toBe(actionTypeId);

    // The original plan must not be polluted with duplicate communities
    const originalCommunities = await db
      .selectFrom('plant_community')
      .selectAll()
      .where('pasture_id', '=', seed.pasture.id)
      .execute();
    expect(originalCommunities).toHaveLength(1);
    expect(originalCommunities[0].id).toBe(1);
  });
});
