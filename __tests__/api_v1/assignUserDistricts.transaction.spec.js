vi.mock('passport');
import { default as request } from 'supertest';
import passport from 'passport';
import createApp from '../../src';
import DataManager from '../../src/libs/db2';
import config from '../../src/config';

const dm = new DataManager(config);
const { db } = dm;

const truncate = (table) => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;

const baseUrl = '/api/v1/user';

describe('UserController.assignUserDistricts() transaction', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.canAccessAgreement = () => true;
  });

  beforeEach(async () => {
    await db.schema.raw(truncate('user_districts'));
    await db.schema.raw(truncate('user_account'));
  });

  test('assigns districts to user successfully', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);

    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/1/assignDistricts`)
      .send({ districts: [{ id: 10 }, { id: 20 }] })
      .expect(200);

    const districts = await db.selectFrom('user_districts').selectAll().execute();
    expect(districts).toHaveLength(2);
    districts.forEach((row) => {
      expect(row.user_id).toBe(1);
    });
    const ids = districts.map((d) => d.id).sort();
    expect(ids).toEqual([10, 20]);
  });

  test('replaces existing districts with new ones', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);

    await db('user_districts').insert([
      { id: 5, user_id: 1 },
      { id: 6, user_id: 1 },
    ]);

    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/1/assignDistricts`)
      .send({ districts: [{ id: 10 }, { id: 20 }] })
      .expect(200);

    const districts = await db.selectFrom('user_districts').selectAll().execute();
    expect(districts).toHaveLength(2);
    const ids = districts.map((d) => d.id).sort();
    expect(ids).toEqual([10, 20]);
  });

  test('allows empty districts array (clears all districts)', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);

    await db('user_districts').insert([{ id: 5, user_id: 1 }]);

    const app = await createApp();

    await request(app).post(`${baseUrl}/1/assignDistricts`).send({ districts: [] }).expect(200);

    const districts = await db.selectFrom('user_districts').selectAll().execute();
    expect(districts).toHaveLength(0);
  });
});
