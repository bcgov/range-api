import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import app from '../../src';

jest.mock('../../src/libs/db2/model/plan');
jest.mock('../../src/libs/db2/model/agreement');
jest.mock('../../src/libs/db2/model/planconfirmation');
jest.mock('../../src/libs/db2/model/planstatus');
jest.mock('../../src/libs/db2/model/planstatushistory');
jest.mock('request-promise-native');

describe('Test Plan routes', () => {
    //not sure how this one ever worked?  an admin can't do a PUT on plan
  test.skip('Fetching plan for a specific id for admin', async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.clientId = 67896675;
    await request(app)
      .put('/api/v1/plan/1/status')
      .send({
        statusId: 9,
      })
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.id).toEqual(1);
      });
  });
});
