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
      .get('/api/v1.1/plan/1')
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
      .get('/api/v1.1/plan/1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((res) => {
        const results = res.body;
        expect(typeof results).toBe('object');
        expect(results.id).toEqual(1);
      });
  });



});

describe('Test Plan Usage Data Based on Agreement Dates', () => {
	test('Can tell FTA usage data from "carry forward" data', async() => {
			expect(true).toBe(false) // FTA only usage data should exist for entire plan date period
	});
	test('Can get usage data for plan with start and end date inside of agreement dates', async() => {
			expect(true).toBe(false) // FTA only usage data should exist for entire plan date period
	});
	test('Can get usage data for plan with end date outside of agreement dates', async() => {
			expect(true).toBe(false) // usage data should exist for entire plan date period, first FTA
			expect(true).toBe(false) // remainder should be based on last year, and carried forward
	});
	test('Can get usage data for plan with end date outside of agreement dates', async() => {
			expect(true).toBe(false) // usage data should exist for entire plan date period, no FTA
			expect(true).toBe(false) // all should be based on ??
	});
});
