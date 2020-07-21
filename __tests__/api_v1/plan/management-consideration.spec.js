import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import createApp from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import districtMocks from '../../../__mocks__/fixtures/ref_district_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import planVersionMocks from '../../../__mocks__/fixtures/plan_version_mock.json';
import managementConsiderationMocks from '../../../__mocks__/fixtures/management_consideration_mock.json';
import clientAgreementMocks from '../../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');


const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/management-consideration';
const body = {
  detail: 'This is the detail for a consideration. This is the detail for a consideration. This is the detail for a consideration. This is the detail for a consideration.',
  url: 'www.google.com',
  considerationTypeId: 1,
  createdAt: (new Date()).toISOString(),
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_district'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('plan_confirmation'));
  await dm.db.schema.raw(truncate('client_agreement'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('plan_version'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('management_consideration'));
};

describe('Test Management Consideration routes', () => {
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
    await dm.db('management_consideration').insert([managementConsideration]);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Creating a management consideration', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          id: 2,
          canonicalId: 2,
          planId: 1,
        });
      });
  });

  test('Creating a management consideration on a nonexistant plan throws a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .post('/api/v1/plan/3/management-consideration')
      .send(body)
      .expect(500);
  });

  test('Updating an existing management consideration', async () => {
    const app = await createApp();

    const detail = 'These are different details than before';

    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          id: 2,
          canonicalId: 2,
          planId: 1,
        });
      });

    await request(app)
      .put(`${baseUrl}/2`)
      .send({ ...body, detail })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          id: 2,
          canonicalId: 2,
          planId: 1,
          detail,
        });
      });
  });

  test('Updating a nonexistant management consideration throws a 500 error', async () => {
    const app = await createApp();
    await request(app)
      .put(`${baseUrl}/200`)
      .send(body)
      .expect(500);
  });

  test('Deleting an existing management consideration', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1`)
      .send()
      .expect(204);
  });

  test('Deleting a nonexistant management consideration throws a 400 error', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/100`)
      .send()
      .expect(400);
  });
});
