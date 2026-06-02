vi.mock('passport');
import { default as request } from 'supertest';
import passport from 'passport';
import createApp from '../../src';
import DataManager from '../../src/libs/db2';
import config from '../../src/config';

const dm = new DataManager(config);
const { db } = dm;

const truncate = (table) => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;

const baseUrl = '/api/v1/plan';

const seedData = {
  user: {
    id: 1,
    username: 'ah_user',
    given_name: 'Agreement',
    family_name: 'Holder',
    email: 'ah@test.ca',
    active: true,
    pia_seen: false,
  },
  district: { id: 1, code: 'TST', description: 'Test District' },
  zone: { id: 1, code: 'TEST1', description: 'Test Zone', district_id: 1, user_id: 1 },
  agreement: {
    forest_file_id: 'RAN076843',
    agreement_start_date: '2017-01-01',
    agreement_end_date: '2041-12-31',
    agreement_type_id: 1,
    zone_id: 1,
  },
  plan: {
    range_name: 'Test Plan',
    plan_start_date: '2019-01-21',
    plan_end_date: '2022-12-30',
    agreement_id: 'RAN076843',
    status_id: 1,
    uploaded: true,
    creator_id: 1,
  },
};

const validAttachment = {
  name: 'test-file.pdf',
  url: 'uploads/test-file.pdf',
  type: 'otherAttachments',
  access: 'staff_only',
};

describe('PlanController attachment endpoints — agreement holder access', () => {
  beforeAll(async () => {
    await db.schema.raw(truncate('plan_file'));
    await db.schema.raw(truncate('user_account'));
    await db.schema.raw(truncate('ref_district'));
    await db.schema.raw(truncate('ref_zone'));
    await db.schema.raw(truncate('plan'));
    await db.schema.raw(truncate('agreement'));

    await db('user_account').insert([seedData.user]);
    await db('ref_district').insert([seedData.district]);
    await db('ref_zone').insert([seedData.zone]);
    await db('agreement').insert([seedData.agreement]);
    await db('plan').insert([seedData.plan]);
  });

  beforeEach(() => {
    passport.aUser.isAgreementHolder = () => true;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => false;
    passport.aUser.isDecisionMaker = () => false;
    passport.aUser.canAccessAgreement = () => true;
  });

  describe('POST /plan/:planId/attachment', () => {
    test('agreement holder can store an attachment', async () => {
      const app = await createApp();

      await request(app)
        .post(`${baseUrl}/1/attachment`)
        .send(validAttachment)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.name).toBe(validAttachment.name);
          expect(res.body.url).toBe(validAttachment.url);
          expect(res.body.type).toBe(validAttachment.type);
          expect(res.body.access).toBe(validAttachment.access);
          expect(res.body.planId).toBe(1);
          expect(res.body.userId).toBe(1);
          expect(res.body.user).toBeDefined();
        });
    });

    test('agreement holder cannot store attachment without access to agreement', async () => {
      passport.aUser.canAccessAgreement = () => false;
      const app = await createApp();

      await request(app).post(`${baseUrl}/1/attachment`).send(validAttachment).expect(403);
    });

    test('agreement holder sees their own staff_only attachment when fetching plan', async () => {
      await db.schema.raw(truncate('plan_file'));
      await db.schema.raw(
        `INSERT INTO plan_file (name, url, type, access, plan_id, user_id) VALUES ('my-file.pdf', 'uploads/my-file.pdf', 'otherAttachments', 'staff_only', 1, 1)`,
      );

      const app = await createApp();

      await request(app)
        .get(`${baseUrl}/1`)
        .expect(200)
        .expect((res) => {
          const files = res.body.files;
          expect(files).toHaveLength(1);
          expect(files[0].name).toBe('my-file.pdf');
          expect(files[0].access).toBe('staff_only');
        });
    });

    test('agreement holder cannot see another user staff_only attachment when fetching plan', async () => {
      await db.schema.raw(truncate('plan_file'));
      await db('user_account').insert([
        {
          id: 2,
          username: 'other',
          given_name: 'Other',
          family_name: 'User',
          email: 'other@test.ca',
          active: true,
          pia_seen: false,
        },
      ]);
      await db.schema.raw(
        `INSERT INTO plan_file (name, url, type, access, plan_id, user_id) VALUES ('other-file.pdf', 'uploads/other-file.pdf', 'otherAttachments', 'staff_only', 1, 2)`,
      );

      const app = await createApp();

      await request(app)
        .get(`${baseUrl}/1`)
        .expect(200)
        .expect((res) => {
          expect(res.body.files).toHaveLength(0);
        });
    });
  });

  describe('PUT /plan/:planId/attachment/:attachmentId', () => {
    let attachmentId;

    beforeEach(async () => {
      await db.schema.raw(truncate('plan_file'));
      await db.schema.raw(
        `INSERT INTO plan_file (name, url, type, access, plan_id, user_id) VALUES ('original.pdf', 'uploads/original.pdf', 'otherAttachments', 'staff_only', 1, 1)`,
      );
      const rows = await db('plan_file').where('plan_id', 1);
      attachmentId = rows[0].id;
    });

    test('agreement holder can update attachment access', async () => {
      const app = await createApp();

      await request(app)
        .put(`${baseUrl}/1/attachment/${attachmentId}`)
        .send({ access: 'everyone' })
        .expect(200)
        .expect((res) => {
          expect(res.body.access).toBe('everyone');
        });
    });

    test('agreement holder cannot update attachment without access to agreement', async () => {
      passport.aUser.canAccessAgreement = () => false;
      const app = await createApp();

      await request(app).put(`${baseUrl}/1/attachment/${attachmentId}`).send({ access: 'everyone' }).expect(403);
    });

    test('returns 404 for non-existent attachment', async () => {
      const app = await createApp();

      await request(app).put(`${baseUrl}/1/attachment/99999`).send({ access: 'everyone' }).expect(404);
    });
  });

  describe('DELETE /plan/:planId/attachment/:attachmentId', () => {
    let attachmentId;

    beforeEach(async () => {
      await db.schema.raw(truncate('plan_file'));
      await db.schema.raw(
        `INSERT INTO plan_file (name, url, type, access, plan_id, user_id) VALUES ('to-delete.pdf', 'uploads/to-delete.pdf', 'otherAttachments', 'staff_only', 1, 1)`,
      );
      const rows = await db('plan_file').where('plan_id', 1);
      attachmentId = rows[0].id;
    });

    test('agreement holder can delete an attachment', async () => {
      const app = await createApp();

      await request(app).delete(`${baseUrl}/1/attachment/${attachmentId}`).expect(204);
    });

    test('agreement holder cannot delete attachment without access to agreement', async () => {
      passport.aUser.canAccessAgreement = () => false;
      const app = await createApp();

      await request(app).delete(`${baseUrl}/1/attachment/${attachmentId}`).expect(403);
    });
  });
});

describe('PlanController attachment endpoints — unauthenticated', () => {
  beforeAll(async () => {
    passport.aUser = null;
  });

  test('POST /plan/:planId/attachment returns 403 for unauthenticated request', async () => {
    const app = await createApp();

    await request(app)
      .post(`${baseUrl}/1/attachment`)
      .send({ name: 'test.pdf', url: 'test.pdf', type: 'otherAttachments' })
      .expect(403);
  });

  test('PUT /plan/:planId/attachment/:attachmentId returns 403 for unauthenticated request', async () => {
    const app = await createApp();

    await request(app).put(`${baseUrl}/1/attachment/1`).send({ access: 'everyone' }).expect(403);
  });

  test('DELETE /plan/:planId/attachment/:attachmentId returns 403 for unauthenticated request', async () => {
    const app = await createApp();

    await request(app).delete(`${baseUrl}/1/attachment/1`).expect(403);
  });
});
