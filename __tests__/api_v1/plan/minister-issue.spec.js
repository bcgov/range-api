import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import app from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import issueMocks from '../../../__mocks__/fixtures/minister_issue_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import planVersionMocks from '../../../__mocks__/fixtures/plan_version_mock.json';
import pastureMocks from '../../../__mocks__/fixtures/pasture_mock.json';
import clientAgreementMocks from '../../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');


const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/issue';
const body = {
  detail: 'This is a pretty big issue',
  objective: 'Our objective is to address the issue....',
  identified: true,
  issueTypeId: 2,
  pastures: [1],
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('client_agreement'));
  await dm.db.schema.raw(truncate('plan_version'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('plan_confirmation'));
  await dm.db.schema.raw(truncate('pasture'));
  await dm.db.schema.raw(truncate('minister_issue'));
};

describe('Test Minister Issue routes', () => {
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
    const issue = issueMocks[0];
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
    await dm.db('minister_issue').insert([issue]);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Creating a minister issue', async () => {
    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          id: 2,
          planId: 2,
        });
      });
  });

  test('Creating a minister issue on a nonexistant plan should throw a 500 error', async () => {
    await request(app)
      .post('/api/v1/plan/2/issue')
      .send(body)
      .expect(500);
  });

  test('Updating an existing minister issue', async () => {
    await request(app)
      .put(`${baseUrl}/1`)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          id: 1,
          planId: 2,
        });
      });
  });

  test('Updating a nonexistant minister issue throws a 500 error', async () => {
    await request(app)
      .put(`${baseUrl}/100`)
      .send(body)
      .expect(500);
  });

  test('Deleting an existing minister issue', async () => {
    await request(app)
      .delete(`${baseUrl}/1`)
      .expect(204);

    const results = await dm.db('minister_issue');
    expect(results).toHaveLength(0);
  });
});
