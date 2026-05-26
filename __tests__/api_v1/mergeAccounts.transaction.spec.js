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

describe('UserController.mergeAccounts() transaction', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;
    passport.aUser.canAccessAgreement = () => true;
  });

  beforeEach(async () => {
    await db.schema.raw(truncate('user_account'));
    await db.schema.raw(truncate('user_feedback'));
    await db.schema.raw(truncate('user_client_link'));
    await db.schema.raw(truncate('user_districts'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('plan_confirmation'));
    await db.schema.raw(truncate('plan_extension_requests'));
    await db.schema.raw(truncate('plan_snapshot'));
    await db.schema.raw(truncate('plan_status_history'));
    await db.schema.raw(truncate('plan_file'));
    await db.schema.raw(truncate('client_agreement'));
    await db.schema.raw(truncate('ref_district'));
    await db.schema.raw(truncate('ref_zone'));
  });

  test('merges two source accounts into target account', async () => {
    const targetUser = { id: 1, username: 'target', email: 'target@test.ca', active: true, pia_seen: false };
    const sourceUser1 = { id: 2, username: 'source1', email: 'source1@test.ca', active: true, pia_seen: false };
    const sourceUser2 = { id: 3, username: 'source2', email: 'source2@test.ca', active: true, pia_seen: false };

    await db('user_account').insert([targetUser, sourceUser1, sourceUser2]);

    await db('user_feedback').insert([
      { user_id: 2, section: 'general', feedback: 'feedback from source1' },
      { user_id: 3, section: 'general', feedback: 'feedback from source2' },
    ]);

    await db('user_client_link').insert([
      { user_id: 2, client_id: '00019863', active: true, type: 'owner' },
      { user_id: 3, client_id: '00203727', active: true, type: 'owner' },
    ]);

    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/1/merge`)
      .send({ accountIds: [2, 3] })
      .expect(200);

    const feedbackRows = await db.selectFrom('user_feedback').selectAll().execute();
    expect(feedbackRows).toHaveLength(2);
    feedbackRows.forEach((row) => {
      expect(row.user_id).toBe(1);
    });

    const linkRows = await db.selectFrom('user_client_link').selectAll().execute();
    expect(linkRows).toHaveLength(2);
    linkRows.forEach((row) => {
      expect(row.user_id).toBe(1);
    });
  });

  test('returns 400 when target user does not exist', async () => {
    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/99999/merge`)
      .send({ accountIds: [1] })
      .expect(400);
  });

  test('returns 400 when source account does not exist', async () => {
    await db('user_account').insert([
      { id: 1, username: 'target', email: 'target@test.ca', active: true, pia_seen: false },
    ]);

    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/1/merge`)
      .send({ accountIds: [99999] })
      .expect(400);
  });
});
