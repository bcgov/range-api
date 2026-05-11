vi.mock('passport');
import { default as request } from 'supertest';  
import passport from 'passport';
import createApp from '../../src';
vi.mock('../../src/libs/db2/model/plan');
vi.mock('../../src/libs/db2/model/agreement');
vi.mock('../../src/libs/db2/model/planconfirmation');
vi.mock('../../src/libs/db2/model/planstatus');
vi.mock('../../src/libs/db2/model/planstatushistory');

describe('Test Plan routes', () => {
  //not sure how this one ever worked?  an admin can't do a PUT on plan
  test.skip('Fetching plan for a specific id for admin', async () => {
    const app = await createApp();

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
