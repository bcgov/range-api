import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import createApp from '../../src';
import userMocks from '../../__mocks__/fixtures/user_account_mock.json';
import districtMocks from '../../__mocks__/fixtures/ref_district_mock.json';
import zoneMocks from '../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../__mocks__/fixtures/plan_mock.json';
import planVersionMocks from '../../__mocks__/fixtures/plan_version_mock.json';
import pastureMocks from '../../__mocks__/fixtures/pasture_mock.json';
import plantCommunityMocks from '../../__mocks__/fixtures/plant_community_mock.json';
import plantCommunityActionMocks from '../../__mocks__/fixtures/plant_community_action_mock.json';
import indicatorPlantMocks from '../../__mocks__/fixtures/indicator_plant_mock.json';
import monitoringAreaMocks from '../../__mocks__/fixtures/monitoring_area_mock.json';
import monitoringAreaPurposeMocks from '../../__mocks__/fixtures/monitoring_area_purpose_mock.json';
import grazingScheduleMocks from '../../__mocks__/fixtures/schedule_mock.json';
import grazingScheduleEntryMocks from '../../__mocks__/fixtures/schedule_entry_mock.json';
import additionalRequirementMocks from '../../__mocks__/fixtures/additional_requirement_mock.json';
import ministerIssueMocks from '../../__mocks__/fixtures/minister_issue_mock.json';
import ministerIssueActionMocks from '../../__mocks__/fixtures/minister_issue_action_mock.json';
import ministerIssuePastureMocks from '../../__mocks__/fixtures/minister_issue_pasture_mock.json';
import managementConsiderationMocks from '../../__mocks__/fixtures/management_consideration_mock.json';
import invasivePlantMocks from '../../__mocks__/fixtures/invasive_plant_mock.json';
import clientAgreementMocks from '../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../src/libs/db2';
import config from '../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');

const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan';
const body = {
  rangeName: 'Create Admin Test',
  planStartDate: '2019-01-21T08:00:00.000Z',
  planEndDate: '2022-12-30T08:00:00.000Z',
  agreementId: 'RAN076843',
  uploaded: true,
  createdAt: '2019-03-28T16:35:58.040Z',
  updatedAt: '2019-03-28T16:35:58.040Z',
  creatorId: 1,
  statusId: 1,
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('ref_district'));
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
    await dm.db('ref_district').insert(districtMocks);
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

  // GET /plan/:planId
  test('Fetching plan for a specific id', async () => {
    const app = await createApp();
    await request(app)
      .get(`${baseUrl}/1`)
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        expect(res.body.id).toEqual(1);
      });
  });

  // GET /plan/:planId where planId does not exist
  test('Fetching a non-existent plan should throw a 404 error', async () => {
    const app = await createApp();
    await request(app)
      .get(`${baseUrl}/3`)
      .expect(404);
  });

  // POST /plan
  test('Create a new plan', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200);
  });

  // POST /plan - creating a plan for a bad :agreementId should throw a 404 error
  test('Creating a plan for a non-existent agreementId should throw an error', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send({ ...body, agreementId: 'bad' })
      .expect(500)
      .expect(res => expect(res.body.error).toBe('Unable to find the related agreement'));
  });

  // POST /plan - attempting to create a plan with an existing :planId should throw a 409 error
  test('Creating a plan with an existing planId should throw a 409 error', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send({ ...body, id: 1 })
      .expect(409);
  });

  // PUT /plan/:planId
  test('Updating a plan', async () => {
    const app = await createApp();

    const rangeName = 'ABC Range';

    await request(app)
      .put(`${baseUrl}/1`)
      .send({ ...body, rangeName })
      .expect(200)
      .expect((res) => {
        const results = res.body;
        expect(results.id).toEqual(1);
        expect(results.rangeName).toEqual(rangeName);
      });
  });

  // PUT /plan/:planId/status - APPROVED
  test('Changing a plan\'s status to approved sets the "effective_at" date', async () => {
    const app = await createApp();

    const status = { statusId: 12, code: 'A' };

    await request(app)
      .put(`${baseUrl}/1/status`)
      .send(status)
      .expect(200)
      .expect(res => expect(res.body.id).toEqual(12));

    await request(app)
      .get(`${baseUrl}/1`)
      .expect(200)
      .expect((res) => {
        const results = res.body;
        expect(results.id).toEqual(1);
        expect(results.statusId).toEqual(12);
        expect(results.effectiveAt).toBeDefined();
      });
  });

  // PUT /plan/:planId/status - if :statusId is not numeric it should throw a 400 error
  test('Updating a plan with a non-numeric statusId should throw a 400 error', async () => {
    const app = await createApp();

    const status = { statusId: 'word' };

    await request(app)
      .put(`${baseUrl}/1/status`)
      .send(status)
      .expect(400);
  });
  // PUT /plan/:planId/status - if :statusId is not valid it should throw a 403 error
  test('Updating a plan with an invalid statusId should throw a 403 error', async () => {
    const app = await createApp();

    const status = { statusId: 100 };

    await request(app)
      .put(`${baseUrl}/1/status`)
      .send(status)
      .expect(403);
  });


  // PUT /plan/:planId/confirmation/:confirmationId - update existing amendment confirmation
  test('Updating an existing amendment confirmation', async () => {
    const app = await createApp();

    const confirmation = {
      planId: 1,
      clientId: 1,
    };

    await request(app)
      .put(`${baseUrl}/1/confirmation/1`)
      .send(confirmation)
      .expect(200)
      .expect(res => expect(res.body.updatedAt).toBeDefined);

    const results = await dm.db('plan').where('id', 1);
    expect(results).toHaveLength(1);
    expect(results[0].status_id).toEqual(14);
  });

  // POST /plan/:planId/status-record - create a plan status history
  test('Creating a plan status history', async () => {
    const app = await createApp();

    const statusHistory = {
      planId: 1,
      fromPlanStatusId: 4,
      toPlanStatusId: 2,
      note: 'Draft -> Complete',
    };

    await request(app)
      .post(`${baseUrl}/1/status-record`)
      .send(statusHistory)
      .expect(200);

    const results = await dm.db('plan_status_history').where('id', 1);
    expect(results).toHaveLength(1);
    expect(results[0].plan_id).toEqual(1);
  });
});
