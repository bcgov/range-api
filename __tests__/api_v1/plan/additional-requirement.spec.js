import { default as request } from "supertest"; // eslint-disable-line
import passport from 'passport';
import createApp from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import districtMocks from '../../../__mocks__/fixtures/ref_district_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../../__mocks__/fixtures/plan_mock.json';
import planVersionMocks from '../../../__mocks__/fixtures/plan_version_mock.json';
import additionalRequirementMocks from '../../../__mocks__/fixtures/additional_requirement_mock.json';
import clientAgreementMocks from '../../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../../__mocks__/fixtures/plan_confirmation_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

jest.mock('request-promise-native');

const { canAccessAgreement } = passport.aUser;
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
const baseUrl = '/api/v1/plan/1/additional-requirement';
const body = {
  url: 'https://example.com',
  detail: 'Details for my additional requirement',
  categoryId: 4,
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
};

describe('Test Additional Requirement routes', () => {
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
    await dm.db('additional_requirement').insert(additionalRequirementMocks);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Creating an additional requirement', async () => {
    const app = await createApp();
    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ ...body, id: 2, planId: 1, canonicalId: 2 });
      });

    const requirements = await dm.db('additional_requirement');

    expect(requirements).toHaveLength(2);
    expect(requirements[0].canonical_id).not.toEqual(requirements[1].canonical_id);
  });

  test('Updating an additional requirement', async () => {
    const app = await createApp();

    const detail = 'Different details';

    await request(app)
      .put(`${baseUrl}/1`)
      .send({ ...body, detail })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ ...body, detail, id: 1, planId: 1, canonicalId: null });
      });

    const requirements = await dm.db('additional_requirement');

    expect(requirements).toHaveLength(1);
    expect(requirements[0].detail).toEqual(detail);
  });

  test('Updating a nonexistant additional requirement throws a 404 error', async () => {
    const app = await createApp();
    await request(app)
      .put(`${baseUrl}/2`)
      .expect(404);
  });

  test('Deleting an additional requirement', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/1`)
      .expect(204);

    const requirements = await dm.db('additional_requirement');

    expect(requirements).toHaveLength(0);
  });

  test('Deleting a nonexistant additional requirement throws a 400 error', async () => {
    const app = await createApp();
    await request(app)
      .delete(`${baseUrl}/5`)
      .expect(400);

    const requirements = await dm.db('additional_requirement');

    expect(requirements).toHaveLength(1);
  });
});
