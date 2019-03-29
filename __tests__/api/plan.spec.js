import { default as request } from 'supertest'; // eslint-disable-line
import passport from 'passport';
import app from '../../src';

jest.mock('../../src/libs/db2/model/plan');
jest.mock('../../src/libs/db2/model/agreement');
// jest.mock('../../src/libs/db2/model/planconfirmation');
// jest.mock('../../src/libs/db2/model/planstatus');
jest.mock('request-promise-native');

describe('Test Plan routes', () => {
  test('Fetching plan for a specific id for admin', async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.clientId = 67896675;
    await request(app)
      .get('/api/v1/plan/1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.id).toEqual(1);
      });
  });

  test('Fetching plan for a specific id for AH', async () => {
    passport.aUser.isAgreementHolder = () => true;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.clientId = '00162356';
    await request(app)
      .get('/api/v1/plan/1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.id).toEqual(1);
      });
  });
});
