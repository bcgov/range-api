import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import app from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import planVersionMocks from '../../../__mocks__/fixtures/plan_version_mock.json';
import pastureMocks from '../../../__mocks__/fixtures/pasture_mock.json';
import plantCommunityMocks from '../../../__mocks__/fixtures/plant_community_mock.json';
import plantCommunityActionMocks from '../../../__mocks__/fixtures/plant_community_action_mock.json';
import indicatorPlantMocks from '../../../__mocks__/fixtures/indicator_plant_mock.json';
import monitoringAreaMocks from '../../../__mocks__/fixtures/monitoring_area_mock.json';
import monitoringAreaPurposeMocks from '../../../__mocks__/fixtures/monitoring_area_purpose_mock.json';
import grazingScheduleMocks from '../../../__mocks__/fixtures/schedule_mock.json';
import grazingScheduleEntryMocks from '../../../__mocks__/fixtures/schedule_entry_mock.json';
import additionalRequirementMocks from '../../../__mocks__/fixtures/additional_requirement_mock.json';
import ministerIssueMocks from '../../../__mocks__/fixtures/minister_issue_mock.json';
import ministerIssueActionMocks from '../../../__mocks__/fixtures/minister_issue_action_mock.json';
import ministerIssuePastureMocks from '../../../__mocks__/fixtures/minister_issue_pasture_mock.json';
import managementConsiderationMocks from '../../../__mocks__/fixtures/management_consideration_mock.json';
import invasivePlantMocks from '../../../__mocks__/fixtures/invasive_plant_mock.json';
import clientAgreementMocks from '../../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');


const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/version';
const body = {
  planId: 1,
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('plan_confirmation'));
  await dm.db.schema.raw(truncate('client_agreement'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('management_consideration'));
  await dm.db.schema.raw(truncate('minister_issue_pasture'));
  await dm.db.schema.raw(truncate('minister_issue_action'));
  await dm.db.schema.raw(truncate('minister_issue'));
  await dm.db.schema.raw(truncate('additional_requirement'));
  await dm.db.schema.raw(truncate('grazing_schedule_entry'));
  await dm.db.schema.raw(truncate('grazing_schedule'));
  await dm.db.schema.raw(truncate('monitoring_area_purpose'));
  await dm.db.schema.raw(truncate('monitoring_area'));
  await dm.db.schema.raw(truncate('indicator_plant'));
  await dm.db.schema.raw(truncate('plant_community'));
  await dm.db.schema.raw(truncate('plant_community_action'));
  await dm.db.schema.raw(truncate('pasture'));
  await dm.db.schema.raw(truncate('invasive_plant_checklist'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('plan_version'));
};

const hasSameCanonicalID = rows =>
  rows.some(r => r.canonical_id === rows[0].canonical_id);

describe('Test Plan routes', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;

    await truncateTables();
  });

  beforeEach(async () => {
    passport.aUser.canAccessAgreement = () => true;

    const user = userMocks[0];
    const zone = zoneMocks[0];
    const agreement = agreementMocks[0];
    const pasture = pastureMocks[0];
    const plantCommunity = plantCommunityMocks[0];
    const plantCommunityAction = plantCommunityActionMocks[0];
    const indicatorPlant = indicatorPlantMocks[0];
    const monitoringArea = monitoringAreaMocks[0];
    const monitoringAreaPurpose = monitoringAreaPurposeMocks[0];
    const grazingSchedule = grazingScheduleMocks[0];
    const grazingScheduleEntry = grazingScheduleEntryMocks[0];
    const additionalRequirement = additionalRequirementMocks[0];
    const ministerIssue = ministerIssueMocks[0];
    const ministerIssueAction = ministerIssueActionMocks[0];
    const ministerIssuePasture = ministerIssuePastureMocks[0];
    const managementConsideration = managementConsiderationMocks[0];
    const clientAgreement = clientAgreementMocks[0];
    const planConfirmation = planConfirmationMocks[0];
    await dm.db('user_account').insert([user]);
    await dm.db('ref_zone').insert([zone]);
    await dm.db('agreement').insert([agreement]);
    await dm.db('client_agreement').insert([clientAgreement]);
    await dm.db('plan').insert(planMocks);
    await dm.db('plan_version').insert(planVersionMocks);
    await dm.db('plan_confirmation').insert([planConfirmation]);
    await dm.db('pasture').insert([pasture]);
    await dm.db('plant_community').insert([plantCommunity]);
    await dm.db('plant_community_action').insert([plantCommunityAction]);
    await dm.db('indicator_plant').insert([indicatorPlant]);
    await dm.db('monitoring_area').insert([monitoringArea]);
    await dm.db('monitoring_area_purpose').insert([monitoringAreaPurpose]);
    await dm.db('grazing_schedule').insert([grazingSchedule]);
    await dm.db('grazing_schedule_entry').insert([grazingScheduleEntry]);
    await dm.db('additional_requirement').insert([additionalRequirement]);
    await dm.db('minister_issue').insert([ministerIssue]);
    await dm.db('minister_issue_action').insert([ministerIssueAction]);
    await dm.db('minister_issue_pasture').insert([ministerIssuePasture]);
    await dm.db('management_consideration').insert([managementConsideration]);
    await dm.db('invasive_plant_checklist').insert(invasivePlantMocks);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  afterAll(async () => {
    await dm.db.destroy();
  });

  test('Creating a new version', async () => {
    const planId = 1;
    await request(app)
      .post(baseUrl)
      .expect(200);

    const versions = await dm.db('plan_version').where('canonical_id', planId);
    expect(versions).toHaveLength(planVersionMocks.length + 1);
  });

  test('Creating a new version modifies the current version record to point to a newly created plan', async () => {
    // canonical ID
    const planId = 1;

    const [originalPlan] = await dm.db('plan').where({ id: 2 });

    await request(app)
      .post(baseUrl)
      .expect(200);

    const [currentVersion] = await dm.db('plan_version')
      .where('canonical_id', planId)
      .where('version', -1);

    expect(currentVersion.plan_id).not.toEqual(originalPlan.id);
    expect(currentVersion.canonical_id).toEqual(planId);

    const [newVersion] = await dm.db('plan_version')
      .where('canonical_id', planId)
      .where('version', 2);

    expect(newVersion.plan_id).toEqual(originalPlan.id);
    expect(newVersion.canonical_id).toEqual(planId);


    expect(
      await dm.db('plan'),
    ).toHaveLength(3);
  });

  test('Throws a 404 error if the plan does not exist with that canonical ID', async () => {
    await request(app)
      .post('/api/v1/plan/10/version')
      .expect(404);
  });

  test('Duplicates all existing records for a plan, keeping the canonical IDs the same', async () => {
    await request(app)
      .post(baseUrl)
      .expect(200);


    const plans = await dm.db('plan');
    const pastures = await dm.db('pasture');
    const plantCommunities = await dm.db('plant_community');
    const indicatorPlants = await dm.db('indicator_plant');
    const monitoringAreas = await dm.db('monitoring_area');
    const monitoringAreaPurposes = await dm.db('monitoring_area_purpose');
    const plantCommunityActions = await dm.db('plant_community_action');
    const grazingSchedules = await dm.db('grazing_schedule');
    const grazingScheduleEntries = await dm.db('grazing_schedule_entry');
    const additionalRequirements = await dm.db('additional_requirement');
    const ministerIssues = await dm.db('minister_issue');
    const ministerIssueActions = await dm.db('minister_issue_action');
    const ministerIssuePastures = await dm.db('minister_issue_pasture');
    const managementConsiderations = await dm.db('management_consideration');

    expect(plans).toHaveLength(3);
    expect(pastures).toHaveLength(2);
    expect(plantCommunities).toHaveLength(2);
    expect(indicatorPlants).toHaveLength(2);
    expect(monitoringAreas).toHaveLength(2);
    expect(monitoringAreaPurposes).toHaveLength(2);
    expect(plantCommunityActions).toHaveLength(2);
    expect(grazingSchedules).toHaveLength(2);
    expect(grazingScheduleEntries).toHaveLength(2);
    expect(additionalRequirements).toHaveLength(2);
    expect(ministerIssues).toHaveLength(2);
    expect(ministerIssueActions).toHaveLength(2);
    expect(ministerIssuePastures).toHaveLength(2);
    expect(managementConsiderations).toHaveLength(2);

    expect(hasSameCanonicalID(plans)).toBeTruthy();
    expect(hasSameCanonicalID(pastures)).toBeTruthy();
    expect(hasSameCanonicalID(plantCommunities)).toBeTruthy();
    expect(hasSameCanonicalID(indicatorPlants)).toBeTruthy();
    expect(hasSameCanonicalID(monitoringAreas)).toBeTruthy();
    expect(hasSameCanonicalID(monitoringAreaPurposes)).toBeTruthy();
    expect(hasSameCanonicalID(plantCommunityActions)).toBeTruthy();
    expect(hasSameCanonicalID(grazingSchedules)).toBeTruthy();
    expect(hasSameCanonicalID(grazingScheduleEntries)).toBeTruthy();
    expect(hasSameCanonicalID(additionalRequirements)).toBeTruthy();
    expect(hasSameCanonicalID(ministerIssues)).toBeTruthy();
    expect(hasSameCanonicalID(ministerIssueActions)).toBeTruthy();
    expect(hasSameCanonicalID(ministerIssuePastures)).toBeTruthy();
    expect(hasSameCanonicalID(managementConsiderations)).toBeTruthy();
  });

  test('Getting each version of a plan', async () => {
    const versions = (await dm.db('plan_version').where('canonical_id', 1));

    await request(app)
      .get(`${baseUrl}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.versions).toHaveLength(versions.length);
        expect(res.body.versions).toEqual(
          versions.map(
            ({
              canonical_id: canonicalId,
              plan_id: planId,
              updated_at: updatedAt,
              created_at: createdAt,
              ...version
            }) => ({
              ...version,
              canonicalId,
              planId,
              updatedAt: updatedAt.toISOString(),
              createdAt: createdAt.toISOString(),
            }),
          ),
        );
      });
  });

  test('Getting the versions of a nonexistant plan throws a 404 error', async () => {
    await request(app)
      .get('/api/v1/plan/2/version')
      .expect(404);
  });

  test('Getting a specific version of a plan', async () => {
    const [version] = await dm.db('plan_version').where('canonical_id', 1).where('version', -1);
    const [plan] = await dm.db('plan').where('id', version.plan_id);

    await request(app)
      .get(`${baseUrl}/-1`)
      .expect(200)
      .expect((res) => {
        expect(res.body.version).toEqual(version.version);
        expect(res.body.id).toEqual(plan.canonical_id);
      });
  });

  test('Getting a nonexistant version of a plan throws a 404 error', async () => {
    await request(app)
      .get(`${baseUrl}/10`)
      .expect(404);
  });
});
