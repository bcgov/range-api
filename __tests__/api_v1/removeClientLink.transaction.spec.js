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

describe('UserController.removeClientLink() transaction', () => {
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

  test('removes client link successfully', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);

    await db('user_client_link').insert([{ user_id: 1, client_id: '00019863', active: true, type: 'owner' }]);

    const app = await createApp();

    await request(app).delete(`${baseUrl}/1/client/00019863`).expect(200);

    const links = await db.selectFrom('user_client_link').selectAll().execute();
    expect(links).toHaveLength(0);
  });

  test('returns 200 even when link does not exist (pre-existing: remove returns array length always 1)', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);

    const app = await createApp();

    await request(app).delete(`${baseUrl}/1/client/NONEXISTENT`).expect(200);
  });

  test('clears only pending extension requests when unlinking a client', async () => {
    await db('user_account').insert([
      { id: 1, username: 'admin', email: 'admin@test.ca', active: true, pia_seen: false },
    ]);
    await db('user_client_link').insert([{ user_id: 1, client_id: '00003055', active: true, type: 'owner' }]);
    await db('plan_extension_requests').insert([
      {
        plan_id: null,
        client_id: '00003055',
        user_id: 1,
        email: 'admin@test.ca',
        requested_extension: null,
      },
      {
        plan_id: null,
        client_id: '00003055',
        user_id: 1,
        email: 'admin@test.ca',
        requested_extension: false,
      },
    ]);

    const app = await createApp();

    await request(app).delete(`${baseUrl}/1/client/00003055`).expect(200);

    const requests = await db
      .selectFrom('plan_extension_requests')
      .selectAll()
      .where('client_id', '=', '00003055')
      .execute();

    expect(requests).toHaveLength(2);

    const pending = requests.find((request) => request.requested_extension === null);
    expect(pending.user_id).toBeNull();
    expect(pending.email).toBeNull();

    const rejected = requests.find((request) => request.requested_extension === false);
    expect(rejected.user_id).toBe(1);
    expect(rejected.email).toBe('admin@test.ca');
  });
});
