import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import app from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import planVersionMocks from '../../../__mocks__/fixtures/plan_version_mock.json';
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
    const plan = planMocks[0];
    const clientAgreement = clientAgreementMocks[0];
    const planConfirmation = planConfirmationMocks[0];
    await dm.db('user_account').insert([user]);
    await dm.db('ref_zone').insert([zone]);
    await dm.db('agreement').insert([agreement]);
    await dm.db('client_agreement').insert([clientAgreement]);
    await dm.db('plan').insert([plan]);
    await dm.db('plan_version').insert(planVersionMocks);
    await dm.db('plan_confirmation').insert([planConfirmation]);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  describe('Creating a new version', () => {
    test('Creating a new version', async () => {
      const planId = 1;
      await request(app)
        .post(baseUrl)
        .send({ ...body, planId })
        .expect(200);
    });

    test('It creates a new version', async () => {
      const planId = 1;
      await request(app)
        .post(baseUrl)
        .send({ ...body, planId })
        .expect(200);

      const versions = await dm.db('plan_version').where('canonical_id', planId);
      expect(versions).toHaveLength(planVersionMocks.length + 1);
    });

    test('It modifies the current version record to point to a newly created plan', async () => {
      // canonical ID
      const planId = 1;

      const [originalPlan] = await dm.db('plan');

      await request(app)
        .post(baseUrl)
        .send({ ...body, planId })
        .expect(200);

      const [currentVersion] = await dm.db('plan_version')
        .where('canonical_id', planId)
        .where('version', -1);

      expect(currentVersion.plan_id).not.toEqual(originalPlan.id);
      expect(currentVersion.canonical_id).toEqual(planId);

      const [newVersion] = await dm.db('plan_version')
        .where('canonical_id', planId)
        .where('version', 3);

      expect(newVersion.plan_id).toEqual(originalPlan.id);
      expect(newVersion.canonical_id).toEqual(planId);


      expect(
        await dm.db('plan'),
      ).toHaveLength(2);
    });

    test('Throws a 404 error if the plan does not exist with that canonical ID', async () => {
      const planId = 5;

      await request(app)
        .post(baseUrl)
        .send({ planId })
        .expect(404);
    });
  });
});
