import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import app from '../../src';
import userMocks from '../../__mocks__/fixtures/user_account_mock.json';
import zoneMocks from '../../__mocks__/fixtures/ref_zone_mock.json';
import agreementMocks from '../../__mocks__/fixtures/agreement_mock.json';
import planMocks from '../../__mocks__/fixtures/plan_mock.json';
import clientAgreementMocks from '../../__mocks__/fixtures/client_agreement_mock.json';
import planConfirmationMocks from '../../__mocks__/fixtures/plan_confirmation_mock.json'
import DataManager from '../../src/libs/db2';
import config from '../../src/config';
const dm = new DataManager(config);

jest.mock('request-promise-native');

const canAccessAgreement = passport.aUser.canAccessAgreement
const truncate = table => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`
const baseUrl = '/api/v1/plan'
const body = {
  id: 2,
  rangeName: "Create Admin Test",
  planStartDate: "2019-01-21T08:00:00.000Z",
  planEndDate: "2022-12-30T08:00:00.000Z",
  agreementId: "RAN123456",
  uploaded: true,
  createdAt: "2019-03-28T16:35:58.040Z",
  updatedAt: "2019-03-28T16:35:58.040Z",
  creatorId: 1,
  statusId: 1
}

describe('Test Plan routes', () => {
  beforeAll(() => {
    passport.aUser.isAgreementHolder = () => false
    passport.aUser.isRangeOfficer = () => false
    passport.aUser.isAdministrator = () => true
  });

  beforeEach(async () => {
    passport.aUser.canAccessAgreement = () => true

    const user = userMocks[0]
    const zone = zoneMocks[0]
    const agreement = agreementMocks[0]
    const plan = planMocks[0]
    const clientAgreement = clientAgreementMocks[0]
    const planConfirmation = planConfirmationMocks[0]
    await dm.db('user_account').insert([ user ])
    await dm.db('ref_zone').insert([ zone ])
    await dm.db('agreement').insert([ agreement ])
    await dm.db('client_agreement').insert([ clientAgreement ])
    await dm.db('plan').insert([ plan ])
    await dm.db('plan_confirmation').insert([ planConfirmation ])
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement

    await dm.db.schema.raw(truncate('user_account'))
    await dm.db.schema.raw(truncate('ref_zone'))
    await dm.db.schema.raw(truncate('plan_confirmation'))
    await dm.db.schema.raw(truncate('client_agreement'))
    await dm.db.schema.raw(truncate('agreement'))
    await dm.db.schema.raw(truncate('plan'))
  });

  // GET /plan/:planId
  test('Fetching plan for a specific id', async () => {
    await request(app)
      .get(`${baseUrl}/1`)
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(res => expect(res.body.id).toEqual(1))
  });

  // GET /plan/:planId where planId does not exist
  test('Fetching a non-existent plan should throw a 404 error', async () => {
    await request(app)
      .get(`${baseUrl}/2`)
      .expect(404)
  });

  // POST /plan
  test('Create a new plan', async () => {
    await request(app)
      .post(baseUrl)
      .send(body)
      .expect(200)
  });

  // POST /plan - creating a plan for a bad :agreementId should throw a 404 error
  test('Creating a plan for a non-existent agreementId should throw an error', async () => {
    await request(app)
      .post(baseUrl)
      .send({ ...body, agreementId: 'bad' })
      .expect(500)
      .expect(res => expect(res.body.error).toBe('Unable to find the related agreement'))
  });

  // POST /plan - attempting to create a plan with an existing :planId should throw a 409 error
  test('Creating a plan with an existing planId should throw a 409 error', async () => {
    await request(app)
      .post(baseUrl)
      .send({ ...body, id: 1 })
      .expect(409)
  });

  // PUT /plan/:planId
  test('Updating a plan', async () => {
    const rangeName = 'ABC Range'

    await request(app)
      .put(`${baseUrl}/1`)
      .send({ ...body, id: 1, rangeName })
      .expect(200)
      .expect(res => {
        const results = res.body
        expect(results.id).toEqual(1)
        expect(results.rangeName).toEqual(rangeName)
      })
  });

  // PUT /plan/:planId/status - APPROVED
  test('Changing a plan\'s status to approved sets the "effective_at" date', async () => {
    const status = { statusId: 12, code: 'A' }

    await request(app)
      .put(`${baseUrl}/1/status`)
      .send(status)
      .expect(200)
      .expect(res => expect(res.body.id).toEqual(12))

    await request(app)
      .get(`${baseUrl}/1`)
      .expect(200)
      .expect((res) => {
        const results = res.body
        expect(results.id).toEqual(1)
        expect(results.statusId).toEqual(12)
        expect(results.effective_at).toBeDefined
      })
  });

  // PUT /plan/:planId/status - if :statusId is not numeric it should throw a 400 error
  test('Updating a plan with a non-numeric statusId should throw a 400 error', async () => {
    const status = { statusId: 'word' }

    await request(app)
      .put(`${baseUrl}/1/status`)
      .send(status)
      .expect(400)
  });
  // PUT /plan/:planId/status - if :statusId is not valid it should throw a 403 error
  test('Updating a plan with an invalid statusId should throw a 403 error', async () => {
    const status = { statusId: 100 }

    await request(app)
      .put(`${baseUrl}/1/status`)
      .send(status)
      .expect(403)
  });


  // PUT /plan/:planId/confirmation/:confirmationId - update existing amendment confirmation
  test('Updating an existing amendment confirmation', async () => {
    const confirmation = {
      planId: 1,
      clientId: '09999901'
    }

    await request(app)
      .put(`${baseUrl}/1/confirmation/1`)
      .send(confirmation)
      .expect(200)
      .expect(res => expect(res.body.updatedAt).toBeDefined)

    const results = await dm.db('plan').where('id', 1)
    expect(results).toHaveLength(1)
    expect(results[0].status_id).toEqual(14)
  })

  // POST /plan/:planId/status-record - create a plan status history
  test('Creating a plan status history', async () => {
    const statusHistory = {
      planId: 1,
      fromPlanStatusId: 4,
      toPlanStatusId: 2,
      note: 'Draft -> Complete'
    }

    await request(app)
      .post(`${baseUrl}/1/status-record`)
      .send(statusHistory)
      .expect(200)

    const results = await dm.db('plan_status_history').where('id', 1)
    expect(results).toHaveLength(1)
    expect(results[0].plan_id).toEqual(1)
  })
});
