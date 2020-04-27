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
import Plan from '../../../src/libs/db2/model/plan';
import Agreement from '../../../src/libs/db2/model/agreement';

const dm = new DataManager(config);

jest.mock('request-promise-native');


const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/version';

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

  test('Creating a new version', async () => {
    const planId = 1;
    await request(app)
      .post(baseUrl)
      .expect(200);

    const snapshots = await dm.db('plan_snapshot').where('id', planId);
    expect(snapshots).toHaveLength(1);
  });

  test('Throws a 404 error if the plan does not exist with that ID', async () => {
    await request(app)
      .post('/api/v1/plan/10/version')
      .expect(404);
  });

  test('Creates an identical snapshot of the plan and stores it as JSON', async () => {
    await request(app)
      .post(baseUrl)
      .expect(200);

    const planId = 1;

    const [{ snapshot }] = await dm.db('plan_snapshot').where('id', planId);

    const [plan] = await Plan.findWithStatusExtension(dm.db, { 'plan.id': planId }, ['id', 'desc']);
    const { agreementId } = plan;

    const [agreement] = await Agreement.findWithTypeZoneDistrictExemption(
      dm.db, { forest_file_id: agreementId },
    );
    await agreement.eagerloadAllOneToManyExceptPlan();
    agreement.transformToV1();

    await plan.eagerloadAllOneToMany();
    plan.agreement = agreement;

    await plan.eagerloadAllOneToMany();

    expect(snapshot).toEqual(JSON.parse(JSON.stringify(plan)));
  });

   test.skip('Getting each version of a plan', async () => {
    await request(app)
      .post(baseUrl)
      .expect(200);

    await request(app)
      .post(baseUrl)
      .expect(200);

    const versions = (await dm.db('plan_snapshot').where('plan_id', 1));

    await request(app)
      .get(`${baseUrl}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.versions).toHaveLength(versions.length);
        expect(res.body.versions).toEqual(
          // eslint-disable-next-line camelcase
          versions.map(({ created_at, plan_id, status_id, ...v }) => ({
            ...v,
            createdAt: created_at.toISOString(),
            planId: plan_id,
            statusId: status_id,
          })),
        );
      });
  });

  test('Getting the versions of a nonexistant plan throws a 404 error', async () => {
    await request(app)
      .get('/api/v1/plan/3/version')
      .expect(404);
  });

  test('Getting a specific version of a plan', async () => {
    await request(app)
      .post(baseUrl)
      .expect(200);

    const [version] = await dm.db('plan_snapshot').where('plan_id', 1).where('version', 1);
    const [plan] = await dm.db('plan').where('id', version.plan_id);

    await request(app)
      .get(`${baseUrl}/1`)
      .expect(200)
      .expect((res) => {
        expect(res.body.version).toEqual(version.version);
        expect(res.body.id).toEqual(plan.id);
      });
  });

  test('Getting a nonexistant version of a plan throws a 404 error', async () => {
    await request(app)
      .get(`${baseUrl}/10`)
      .expect(404);
  });

  test.only('Restoring a snapshot of a plan', async () => {
    await request(app)
      .post(baseUrl)
      .expect(200);

    const newName = 'A different name';
    const originalName = (await dm.db('plan').where('id', 1).first()).range_name;
    
    await dm.db.raw('UPDATE plan SET range_name=? WHERE id=1', [newName]);

    expect((await dm.db('plan').where('id', 1).first()).range_name).toEqual(newName);

    await request(app)
      .post(`${baseUrl}/1/restore`)
      .expect(200);

    expect((await dm.db('plan').where('id', 1).first()).range_name).toEqual(originalName);
  });

  test('Restoring a nonexistant snapshot of a plan throws a 404 error', async () => {
    await request(app)
      .post(`${baseUrl}/1/restore`)
      .expect(404);
  });
});
