import { default as request } from "supertest"; // eslint-disable-line
import passport from 'passport';
import app from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import pastureMocks from '../../../__mocks__/fixtures/pasture_mock.json';
import plantCommunityMocks from '../../../__mocks__/fixtures/plant_community_mock.json';
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
};

const plantCommunityActionBody = {
  actionTypeId: 1,
  name: 'plant community action',
  details: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  noGrazeStartDay: 27,
  noGrazeStartMonth: 1,
  noGrazeEndDay: 2,
  noGrazeEndMonth: 5,
};

const indicatorPlantBody = {
  plantSpeciesId: 13,
  criteria: 'shrubuse',
  value: 2,
  name: 'Shrub use',
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
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('plan_confirmation'));
  await dm.db.schema.raw(truncate('client_agreement'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('pasture'));
  await dm.db.schema.raw(truncate('plant_community'));
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
    const plan = planMocks[0];
    const pasture = pastureMocks[0];
    const plantCommunity = plantCommunityMocks[0];
    const clientAgreement = clientAgreementMocks[0];
    const planConfirmation = planConfirmationMocks[0];
    await dm.db('user_account').insert([user]);
    await dm.db('ref_zone').insert([zone]);
    await dm.db('agreement').insert([agreement]);
    await dm.db('client_agreement').insert([clientAgreement]);
    await dm.db('plan').insert([plan]);
    await dm.db('plan_confirmation').insert([planConfirmation]);
    await dm.db('pasture').insert([pasture]);
    await dm.db('plant_community').insert([plantCommunity]);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Creating a new pasture', async () => {
    await request(app)
      .post(baseUrl)
      .send(pastureBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...pastureBody,
          id: 2,
          planId: 1,
        });
      });
  });

  test('Trying to create a pasture with an already-used id should throw a 500 error', async () => {
    await request(app)
      .post(baseUrl)
      .send({ ...pastureBody, id: 1 })
      .expect(500);
  });

  test('Updating a pasture', async () => {
    const name = "Roop's Pasture 2.0";

    await request(app)
      .put(`${baseUrl}/1`)
      .send({ ...pastureBody, id: 1, name })
      .expect(200)
      .expect((res) => {
        const results = res.body;
        expect(results.id).toEqual(1);
        expect(results.name).toEqual(name);
      });
  });

  test('Creating a plant community', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community`)
      .send(plantCommunityBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...plantCommunityBody,
          id: 2,
          pastureId: 1,
        });
      });
  });

  test('Creating a plant community on a nonexistant pasture should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/4/plant-community`)
      .send(plantCommunityBody)
      .expect(500);
  });

  test('Creating a plant community with an incorrenct purpose of action should error', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community`)
      .send({ ...plantCommunityBody, purposeOfAction: 'not an allowed value' })
      .expect(500);
  });

  test('Creating a plant community action', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/action`)
      .send(plantCommunityActionBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...plantCommunityActionBody,
          id: 1,
          plantCommunityId: 1,
        });
      });
  });

  test('Creating a plant community action on a nonexistant pasture should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/12/plant-community/1/action`)
      .send(plantCommunityActionBody)
      .expect(500);
  });

  test('Creating a plant community action on a nonexistant plant community should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/10/action`)
      .send(plantCommunityActionBody)
      .expect(500);
  });

  test('Creating an indicator plant', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/indicator-plant`)
      .send(indicatorPlantBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...indicatorPlantBody,
          id: 1,
          plantCommunityId: 1,
        });
      });
  });

  test('Creating an indicator plant on a nonexistant pasture should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/10/plant-community/1/indicator-plant`)
      .send(indicatorPlantBody)
      .expect(500);
  });

  test('Creating an indicator plant on a nonexistant plant community should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/10/indicator-plant`)
      .send(indicatorPlantBody)
      .expect(500);
  });

  test('Creating an indicator plant with an incorrect criteria should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/indicator-plant`)
      .send({ ...indicatorPlantBody, criteria: 'not a real criteria' })
      .expect(500);
  });

  // Monitoring area

  test('Creating a monitoring area', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/monitoring-area`)
      .send(monitoringAreaBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...monitoringAreaBody,
          id: 1,
          plantCommunityId: 1,
          purposes: [
            {
              id: 1,
              monitoringAreaId: 1,
              purposeType: {
                active: true,
                id: 1,
                name: 'Range Readiness',
              },
              purposeTypeId: 1,
            },
            {
              id: 2,
              monitoringAreaId: 1,
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
    await request(app)
      .post(`${baseUrl}/10/plant-community/1/monitoring-area`)
      .send(monitoringAreaBody)
      .expect(500);
  });

  test('Creating a monitoring area on a nonexistant plant community should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/10/monitoring-area`)
      .send(monitoringAreaBody)
      .expect(500);
  });

  test('Creating a monitoring area with an incorrect purpose type should throw a 500 error', async () => {
    await request(app)
      .post(`${baseUrl}/1/plant-community/1/monitoring-area`)
      .send({ ...monitoringAreaBody, purposeTypeIds: [10, 100, '2', 1] })
      .expect(500);
  });
});
