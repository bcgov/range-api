import { default as request } from "supertest"; // eslint-disable-line
import passport from 'passport';
import createApp from '../../../src';
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
import clientAgreementMocks from '../../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');

const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/pasture';
const pastureBody = {
  name: "Roop's Pasture",
  allowableAum: 200,
  graceDays: 7,
  pldPercent: 0.3,
  notes: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  createdAt: (new Date()).toISOString(),
};

const plantCommunityBody = {
  communityTypeId: 1,
  purposeOfAction: 'none',
  elevationId: 2,
  shrubUse: 0.8,
  name: 'My Plant Community',
  aspect: 'aspect',
  url: 'http://example.com',
  notes: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  rangeReadinessDay: 14,
  rangeReadinessMonth: 4,
  rangeReadinessNote:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  approved: false,
  createdAt: (new Date()).toISOString(),
};

const plantCommunityActionBody = {
  actionTypeId: 1,
  name: 'plant community action',
  details: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  noGrazeStartDay: 27,
  noGrazeStartMonth: 1,
  noGrazeEndDay: 2,
  noGrazeEndMonth: 5,
  createdAt: (new Date()).toISOString(),
};

const indicatorPlantBody = {
  plantSpeciesId: 13,
  criteria: 'shrubuse',
  value: 2,
  name: 'Shrub use',
  createdAt: (new Date()).toISOString(),
};

const monitoringAreaBody = {
  rangelandHealthId: 3,
  otherPurpose: 'the other purpose',
  purposeTypeIds: [1, 2],
  name: "Roop's monitoring area",
  longitude: 58.6886,
  latitude: -114.965,
  transectAzimuth: 10,
  location: 'Here',
  createdAt: (new Date()).toISOString(),
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('plan_confirmation'));
  await dm.db.schema.raw(truncate('client_agreement'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('plan_version'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('pasture'));
  await dm.db.schema.raw(truncate('plant_community'));
  await dm.db.schema.raw(truncate('plant_community_action'));
  await dm.db.schema.raw(truncate('indicator_plant'));
  await dm.db.schema.raw(truncate('monitoring_area'));
  await dm.db.schema.raw(truncate('monitoring_area_purpose'));
};

describe('Test Pasture routes', () => {
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
    await dm.db('plant_community_action').insert(plantCommunityActionMocks);
    await dm.db('indicator_plant').insert(indicatorPlantMocks);
    await dm.db('monitoring_area').insert(monitoringAreaMocks);
    await dm.db('monitoring_area_purpose').insert(monitoringAreaPurposeMocks);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Creating a new pasture', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send(pastureBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...pastureBody,
          id: 2,
          planId: 1,
          canonicalId: 2,
        });
      });
  });

  test('Creating a new pasture adds it to the current version plan', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send(pastureBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...pastureBody,
          id: 2,
          planId: 1,
          canonicalId: 2,
        });
      });

    expect(await dm.db('pasture').where({ plan_id: 1 })).toHaveLength(2);
    expect(await dm.db('pasture').where({ plan_id: 2 })).toHaveLength(0);
  });

  test('Trying to create a pasture with an already-used id should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send({ ...pastureBody, id: 1 })
      .expect(500);
  });

  test('Updating a pasture affects the current version of the plan', async () => {
    const app = await createApp();

    const name = "Roop's Pasture 2.0";

    const planId = 1;

    await request(app)
      .put(`${baseUrl}/1`)
      .send({ ...pastureBody, name })
      .expect(200)
      .expect((res) => {
        const results = res.body;
        expect(results.id).toEqual(1);
        expect(results.name).toEqual(name);
        expect(results.planId).toEqual(planId);
      });
  });

  test('Creating a plant community', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community`)
      .send(plantCommunityBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...plantCommunityBody,
          id: 2,
          pastureId: 1,
          canonicalId: 2,
        });
      });
  });

  test('Creating a plant community on a nonexistant pasture should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/4/plant-community`)
      .send(plantCommunityBody)
      .expect(500);
  });

  test('Creating a plant community with an incorrenct purpose of action should error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community`)
      .send({ ...plantCommunityBody, purposeOfAction: 'not an allowed value' })
      .expect(500);
  });

  test('Creating a plant community action', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/action`)
      .send(plantCommunityActionBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...plantCommunityActionBody,
          id: 2,
          plantCommunityId: 1,
          canonicalId: 2,
        });
      });
  });

  test('Updating a plant community', async () => {
    const app = await createApp();
    const name = 'My updated plant community';

    await request(app)
      .put(`${baseUrl}/1/plant-community/1`)
      .send({ ...plantCommunityBody, name })
      .expect(200)
      .expect((res) => {
        const results = res.body;
        expect(results.id).toEqual(1);
        expect(results.name).toEqual(name);
        expect(results.pastureId).toEqual(1);
      });
  });

  test('Updating a non-existant plant community throws a 404 error', async () => {
    const app = await createApp();
    await request(app)
      .put(`${baseUrl}/1/plant-community/10`)
      .send({ ...plantCommunityBody })
      .expect(404);
  });

  test('Updating a plant community on an non-existant pasture throws a 404 error', async () => {
    const app = await createApp();
    await request(app)
      .put(`${baseUrl}/10/plant-community/1`)
      .send({ ...plantCommunityBody })
      .expect(404);
  });

  test('Deleting a plant community', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1/plant-community/1`)
      .expect(204);

    expect(await dm.db('plant_community')).toHaveLength(0);
  });

  test('Deleting a nonexistant plant community throws a 400 error', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1/plant-community/2`)
      .expect(400);

    expect(await dm.db('plant_community')).toHaveLength(1);
  });

  test('Creating a plant community action on a nonexistant pasture should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/12/plant-community/1/action`)
      .send(plantCommunityActionBody)
      .expect(500);
  });

  test('Creating a plant community action on a nonexistant plant community should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/10/action`)
      .send(plantCommunityActionBody)
      .expect(500);
  });

  test('Updating a plant community action', async () => {
    const name = 'new name for plant community action';

    const app = await createApp();
    await request(app)
      .put(`${baseUrl}/1/plant-community/1/action/1`)
      .send({ name })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toEqual(name);
      });

    expect(await dm.db('plant_community_action')).toHaveLength(1);
  });

  test('Updating a nonexistant plant community action throws a 404 error', async () => {
    const name = 'new name for plant community action';

    const app = await createApp();
    await request(app)
      .put(`${baseUrl}/1/plant-community/1/action/10`)
      .send({ name })
      .expect(404);

    const actions = await dm.db('plant_community_action');

    expect(actions).toHaveLength(1);
    expect(actions[0].name).not.toEqual(name);
  });

  test('Deleting a plant community action', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1/plant-community/1/action/1`)
      .expect(204);

    expect(await dm.db('plant_community_action')).toHaveLength(0);
  });

  test('Deleting a nonexistant plant community action throws a 400 error', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1/plant-community/1/action/10`)
      .expect(400);

    expect(await dm.db('plant_community_action')).toHaveLength(1);
  });

  test('Creating an indicator plant', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/indicator-plant`)
      .send(indicatorPlantBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...indicatorPlantBody,
          id: 2,
          plantCommunityId: 1,
          canonicalId: 2,
        });
      });
  });

  test('Creating an indicator plant on a nonexistant pasture should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/10/plant-community/1/indicator-plant`)
      .send(indicatorPlantBody)
      .expect(500);
  });

  test('Creating an indicator plant on a nonexistant plant community should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/10/indicator-plant`)
      .send(indicatorPlantBody)
      .expect(500);
  });

  test('Creating an indicator plant with an incorrect criteria should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/indicator-plant`)
      .send({ ...indicatorPlantBody, criteria: 'not a real criteria' })
      .expect(500);
  });

  test('Updating an indicator plant', async () => {
    const app = await createApp();
    const value = 100.4;

    await request(app)
      .put(`${baseUrl}/1/plant-community/1/indicator-plant/1`)
      .send({ value })
      .expect(200)
      .expect((res) => {
        expect(res.body.value).toEqual(value);
      });

    const plants = await dm.db('indicator_plant');
    expect(plants).toHaveLength(1);
    expect(plants[0].value).toEqual(value);
  });

  test('Updating a nonexistant indicator plant throws a 404 error', async () => {
    const app = await createApp();
    const value = 100.4;

    await request(app)
      .put(`${baseUrl}/1/plant-community/1/indicator-plant/10`)
      .send({ value })
      .expect(404);

    const plants = await dm.db('indicator_plant');
    expect(plants).toHaveLength(1);
    expect(plants[0].value).not.toEqual(value);
  });

  test('Updating an indicator plant on a non-existant plant community throws a 500 error', async () => {
    const app = await createApp();
    const value = 100.4;

    await request(app)
      .put(`${baseUrl}/1/plant-community/10/indicator-plant/1`)
      .send({ value })
      .expect(500);

    const plants = await dm.db('indicator_plant');
    expect(plants).toHaveLength(1);
    expect(plants[0].value).not.toEqual(value);
  });

  test('Deleting an indicator plant', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1/plant-community/1/indicator-plant/1`)
      .expect(204);

    const plants = await dm.db('indicator_plant');
    expect(plants).toHaveLength(0);
  });

  test('Deleting a nonexistant indicator plant throws a 400 error', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1/plant-community/1/indicator-plant/2`)
      .expect(400);

    const plants = await dm.db('indicator_plant');
    expect(plants).toHaveLength(1);
  });

  // Monitoring area

  test('Creating a monitoring area', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/monitoring-area`)
      .send(monitoringAreaBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...monitoringAreaBody,
          id: 2,
          plantCommunityId: 1,
          canonicalId: 2,
          purposes: [
            {
              id: 2,
              canonicalId: 2,
              monitoringAreaId: 2,
              purposeType: {
                active: true,
                id: 1,
                name: 'Range Readiness',
              },
              purposeTypeId: 1,
            },
            {
              id: 3,
              canonicalId: 3,
              monitoringAreaId: 2,
              purposeType: {
                active: true,
                id: 2,
                name: 'Stubble Height',
              },
              purposeTypeId: 2,
            },
          ],
        });
      });
  });

  test('Creating a monitoring area on a nonexistant pasture should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/10/plant-community/1/monitoring-area`)
      .send(monitoringAreaBody)
      .expect(500);
  });

  test('Creating a monitoring area on a nonexistant plant community should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/10/monitoring-area`)
      .send(monitoringAreaBody)
      .expect(500);
  });

  test('Creating a monitoring area with an incorrect purpose type should throw a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/monitoring-area`)
      .send({ ...monitoringAreaBody, purposeTypeIds: [10, 100, '2', 1] })
      .expect(500);
  });

  test('Updating a monitoring area', async () => {
    const app = await createApp();

    const name = 'new area name';
    const purposes = await dm.db('monitoring_area_purpose');
    expect(purposes).toHaveLength(1);
    const existingPurposeTypeId = purposes[0].id;

    const newPurposeTypeId = 2;

    await request(app)
      .put(`${baseUrl}/1/plant-community/1/monitoring-area/1`)
      .send({ purposeTypeIds: [existingPurposeTypeId, newPurposeTypeId], name })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toEqual(name);
        expect(res.body.purposes).toHaveLength(2);
        expect(res.body.purposes[0].id).toEqual(purposes[0].id);
        expect(res.body.purposes[0].purposeTypeId).toEqual(existingPurposeTypeId);
        expect(res.body.purposes[1].id).not.toEqual(purposes[0].id);
        expect(res.body.purposes[1].purposeTypeId).toEqual(newPurposeTypeId);
      });

    const areas = await dm.db('monitoring_area');
    expect(areas).toHaveLength(1);
    expect(areas[0].name).toEqual(name);

    const updatedPurposes = await dm.db('monitoring_area_purpose');
    expect(updatedPurposes).toHaveLength(2);
    expect(updatedPurposes[0].monitoring_area_id).toEqual(1);
    expect(updatedPurposes[1].monitoring_area_id).toEqual(1);
  });

  test('Deleting a monitoring area purpose via update', async () => {
    const app = await createApp();

    const purposes = await dm.db('monitoring_area_purpose');
    expect(purposes).toHaveLength(1);

    await request(app)
      .put(`${baseUrl}/1/plant-community/1/monitoring-area/1`)
      .send({ purposeTypeIds: [] })
      .expect(200)
      .expect((res) => {
        expect(res.body.purposes).toHaveLength(0);
      });

    const updatedPurposes = await dm.db('monitoring_area_purpose');
    expect(updatedPurposes).toHaveLength(0);
  });

  test('Updating a nonexistant monitoring area throws a 404 error', async () => {
    const app = await createApp();

    const name = 'new area name';

    await request(app)
      .put(`${baseUrl}/1/plant-community/1/monitoring-area/2`)
      .send({ name })
      .expect(404);

    const areas = await dm.db('monitoring_area');
    expect(areas).toHaveLength(1);
    expect(areas[0].name).not.toEqual(name);
  });

  test('Deleting a monitoring area', async () => {
    const app = await createApp();

    expect(await dm.db('monitoring_area')).toHaveLength(1);
    expect(await dm.db('monitoring_area_purpose')).toHaveLength(1);

    await request(app)
      .delete(`${baseUrl}/1/plant-community/1/monitoring-area/1`)
      .expect(204);

    expect(await dm.db('monitoring_area')).toHaveLength(0);
    expect(await dm.db('monitoring_area_purpose')).toHaveLength(0);
  });

  test('Deleting a nonexistant monitoring area throws a 400 error', async () => {
    const app = await createApp();

    expect(await dm.db('monitoring_area')).toHaveLength(1);
    expect(await dm.db('monitoring_area_purpose')).toHaveLength(1);

    await request(app)
      .delete(`${baseUrl}/1/plant-community/1/monitoring-area/2`)
      .expect(400);

    expect(await dm.db('monitoring_area')).toHaveLength(1);
    expect(await dm.db('monitoring_area_purpose')).toHaveLength(1);
  });
});
