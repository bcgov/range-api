import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import app from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import issueMocks from '../../../__mocks__/fixtures/minister_issue_mock.json';
import issueActionMocks from '../../../__mocks__/fixtures/minister_issue_action_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import pastureMocks from '../../../__mocks__/fixtures/pasture_mock.json';
import clientAgreementMocks from '../../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');


const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/issue/1/action';
const body = {
  detail: 'This is an action!',
  actionTypeId: 4,
  other: 'this is other',
  noGrazeStartMonth: 6,
  noGrazeStartDay: 12,
  noGrazeEndMonth: 4,
  noGrazeEndDay: 23,
};

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('client_agreement'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('plan_confirmation'));
  await dm.db.schema.raw(truncate('pasture'));
  await dm.db.schema.raw(truncate('minister_issue'));
  await dm.db.schema.raw(truncate('minister_issue_action'));
};

describe('Test Minister Issue Action routes', () => {
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
    const issue = issueMocks[0];
    const issueAction = issueActionMocks[0];
    const clientAgreement = clientAgreementMocks[0];
    const planConfirmation = planConfirmationMocks[0];
    await dm.db('user_account').insert([user]);
    await dm.db('ref_zone').insert([zone]);
    await dm.db('agreement').insert([agreement]);
    await dm.db('client_agreement').insert([clientAgreement]);
    await dm.db('plan').insert([plan]);
    await dm.db('plan_confirmation').insert([planConfirmation]);
    await dm.db('pasture').insert([pasture]);
    await dm.db('minister_issue').insert([issue]);
    await dm.db('minister_issue_action').insert([issueAction]);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Creating a minister issue action', async () => {
    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          id: 2,
          canonicalId: res.body.id,
          issueId: 1,
          noGrazeStartMonth: null,
          noGrazeStartDay: null,
          noGrazeEndMonth: null,
          noGrazeEndDay: null,
          other: null,
        });
      });

    const results = await dm.db('minister_issue_action');
    expect(results).toHaveLength(2);
  });

  test('Only sets noGraze when type is timing', async () => {
    const actionTypeId = 5;

    await request(app)
      .post(baseUrl)
      .send({ ...body, actionTypeId })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          other: null,
          actionTypeId,
          id: 2,
          canonicalId: res.body.id,
          issueId: 1,
        });
      });
  });

  test('Only sets other field when type is other', async () => {
    const actionTypeId = 6;

    await request(app)
      .post(baseUrl)
      .send({ ...body, actionTypeId })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          actionTypeId,
          noGrazeStartMonth: null,
          noGrazeStartDay: null,
          noGrazeEndMonth: null,
          noGrazeEndDay: null,
          id: 2,
          canonicalId: res.body.id,
          issueId: 1,
        });
      });
  });

  test('Creating a minister issue action on a nonexistant minister issue throws a 500 error', async () => {
    await request(app)
      .post('/api/v1/plan/1/issue/10/action')
      .send(body)
      .expect(500);
  });

  test('Updating a minister issue action', async () => {
    await request(app)
      .put(`${baseUrl}/1`)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ...body,
          id: 1,
          issueId: 1,
          canonicalId: 1,
          noGrazeStartMonth: null,
          noGrazeStartDay: null,
          noGrazeEndMonth: null,
          noGrazeEndDay: null,
          other: null,
        });
      });
  });

  test('Deleting a minister issue action', async () => {
    await request(app)
      .delete(`${baseUrl}/1`)
      .expect(204);

    const results = await dm.db('minister_issue_action');
    expect(results).toHaveLength(0);
  });

  test('Deleting a non-existant minister issue action does nothing', async () => {
    await request(app)
      .delete(`${baseUrl}/10`)
      .expect(204);

    const results = await dm.db('minister_issue_action');
    expect(results).toHaveLength(1);
  });
});
