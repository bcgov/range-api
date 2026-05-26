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

describe('UserController.addClientLink() transaction', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.canAccessAgreement = () => true;
  });

  beforeEach(async () => {
    await db.schema.raw(truncate('plan_extension_requests'));
    await db.schema.raw(truncate('plan_confirmation'));
    await db.schema.raw(truncate('client_agreement'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('user_client_link'));
    await db.schema.raw(truncate('user_account'));
  });

  test('creates client link on valid POST', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);

    const app = await createApp();

    await request(app).post(`${baseUrl}/1/client`).send({ clientId: '00019863' }).expect(200);

    const links = await db.selectFrom('user_client_link').selectAll().execute();
    expect(links).toHaveLength(1);
    expect(links[0].user_id).toBe(1);
    expect(links[0].client_id).toBe('00019863');
    expect(links[0].active).toBe(true);
    expect(links[0].type).toBe('owner');
  });

  test('returns 500 when userId does not exist (FK violation on insert)', async () => {
    const app = await createApp();

    await request(app).post(`${baseUrl}/99999/client`).send({ clientId: '00019863' }).expect(500);
  });

  test('returns 400 when client does not exist', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);

    const app = await createApp();

    await request(app).post(`${baseUrl}/1/client`).send({ clientId: 'NONEXISTENT' }).expect(400);
  });
});
