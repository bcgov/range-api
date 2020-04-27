import { default as request } from "supertest"; // eslint-disable-line
import passport from 'passport';
import createApp from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import planVersionMocks from '../../../__mocks__/fixtures/plan_version_mock.json';
import scheduleMocks from '../../../__mocks__/fixtures/schedule_mock.json';
import pastureMocks from '../../../__mocks__/fixtures/pasture_mock.json';
import clientAgreementMocks from '../../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');

const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/schedule';
const body = {
  year: 2021,
  narative: 'This is a narative',
  grazingScheduleEntries: [],
  sortBy: 'livestockCount',
  sortOrder: 'asc',
  createdAt: (new Date()).toISOString(),
};
const entryBody = {
  livestockCount: 10,
  dateIn: '2019-03-15T16:52:37.658Z',
  dateOut: '2019-08-17T16:52:37.658Z',
  createdAt: (new Date()).toISOString(),
  pastureId: 1,
  livestockTypeId: 2,
  graceDays: 4,
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('plan_confirmation'));
  await dm.db.schema.raw(truncate('client_agreement'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('plan_version'));
  await dm.db.schema.raw(truncate('pasture'));
  await dm.db.schema.raw(truncate('grazing_schedule'));
};

describe('Test Schedule routes', () => {
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
    const schedule = scheduleMocks[0];
    const pasture = pastureMocks[0];
    const clientAgreement = clientAgreementMocks[0];
    const planConfirmation = planConfirmationMocks[0];
    await dm.db('user_account').insert([user]);
    await dm.db('ref_zone').insert([zone]);
    await dm.db('agreement').insert([agreement]);
    await dm.db('client_agreement').insert([clientAgreement]);
    await dm.db('plan').insert(planMocks);
    await dm.db('plan_version').insert(planVersionMocks);
    await dm.db('plan_confirmation').insert([planConfirmation]);
    await dm.db('grazing_schedule').insert([schedule]);
    await dm.db('pasture').insert([pasture]);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Creating a schedule', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          sortBy: 'livestock_count',
          planId: 1,
          id: 2,
          canonicalId: 2,
        });
      });
  });

  test('Creating a schedule with for a nonexistant plan throws a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post('/api/v1/plan/3/schedule')
      .send(body)
      .expect(500);
  });

  test('Updating an existing schedule', async () => {
    const app = await createApp();

    const narative = 'This is the new narrative';
    await request(app)
      .put(`${baseUrl}/1`)
      .send({ ...body, narative })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          sortBy: 'livestock_count',
          narative,
          id: 1,
          canonicalId: 1,
          planId: 1,
        });
      });
  });

  test('Updating a nonexistant schedule throws a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .put(`${baseUrl}/100`)
      .send(body)
      .expect(500);
  });

  test('Deleting an existing schedule', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1`)
      .send()
      .expect(204);
  });

  test('Deleting a nonexistant schedule throws a 400 error', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/10`)
      .send()
      .expect(400);
  });

  test('Creating a schedule entry', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/entry`)
      .send(entryBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...entryBody,
          id: 1,
          canonicalId: 1,
          grazingScheduleId: 1,
        });
      });
  });

  test('Creating an entry on a nonexistant schedule throws a 400 error', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/20/entry`)
      .send(entryBody)
      .expect(400);
  });

  test('Deleting an existing schedule entry', async () => {
    const app = await createApp();
    await request(app)
      .post(`${baseUrl}/1/entry`)
      .send(entryBody)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...entryBody,
          id: 1,
          canonicalId: 1,
          grazingScheduleId: 1,
        });
      });

    await request(app)
      .delete(`${baseUrl}/1/entry/1`)
      .send()
      .expect(204);
  });

  test('Creating an entry by updating the schedule', async () => {
    const app = await createApp();

    const grazingScheduleEntries = [entryBody];

    await request(app)
      .put(`${baseUrl}/1`)
      .send({ ...body, grazingScheduleEntries })
      .expect(200)
      .expect((res) => {
        expect(res.body.grazingScheduleEntries[0]).toEqual({
          ...entryBody,
          id: 1,
          canonicalId: 1,
          grazingScheduleId: 1,
          livestockType: {
            active: true,
            auFactor: 1.5,
            id: 2,
            name: 'Bull',
          },
        });
      });
  });
});
