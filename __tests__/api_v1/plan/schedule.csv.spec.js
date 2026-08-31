vi.mock('passport');
import { default as request } from 'supertest';
import passport from 'passport';
import createApp from '../../../src';
import userMocks from '../../../__mocks__/fixtures/user_account_mock.json';
import districtMocks from '../../../__mocks__/fixtures/ref_district_mock.json';
import zoneMocks from '../../../__mocks__/fixtures/ref_zone_mock.json';
import DataManager from '../../../src/libs/db2';
import config from '../../../src/config';

const dm = new DataManager(config);

const { canAccessAgreement } = passport.aUser;
const truncate = (table) => `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;

const AGREEMENT_ID = 'RAN076843';
const GRAZING_SCHEDULE_ID = 1;
const OTHER_PLAN_SCHEDULE_ID = 2;

const csvUrl = (planId, scheduleId) => `/api/v1/plan/${planId}/schedule/${scheduleId}/csv`;

const timestamps = {
  created_at: '2019-03-28T16:35:58.040Z',
  updated_at: '2019-03-28T16:35:58.040Z',
};

const agreement = {
  forest_file_id: AGREEMENT_ID,
  agreement_start_date: '2017-01-01T08:00:00.000Z',
  agreement_end_date: '2041-12-31T08:00:00.000Z',
  zone_id: 2,
  // agreement_type_id 1 => grazing schedule
  agreement_type_id: 1,
  exemption_status: 'NOT_EXEMPTED',
  ...timestamps,
};

const plans = [
  {
    id: 1,
    canonical_id: 1,
    range_name: "XYZ's Range",
    agreement_id: AGREEMENT_ID,
    status_id: 1,
    creator_id: 1,
    uploaded: true,
    ...timestamps,
  },
  {
    id: 2,
    canonical_id: 2,
    range_name: "XYZ's Other Range",
    agreement_id: AGREEMENT_ID,
    status_id: 1,
    creator_id: 1,
    uploaded: true,
    ...timestamps,
  },
];

const pastures = [
  { id: 1, plan_id: 1, name: 'Alpha Pasture', allowable_aum: 100, grace_days: 10, pld_percent: 0.5, ...timestamps },
  { id: 2, plan_id: 1, name: 'Bravo Pasture', allowable_aum: 100, grace_days: 10, pld_percent: 0.5, ...timestamps },
];

const schedules = [
  { id: GRAZING_SCHEDULE_ID, canonical_id: 1, plan_id: 1, year: 2024, narative: 'Schedule details', ...timestamps },
  { id: OTHER_PLAN_SCHEDULE_ID, canonical_id: 2, plan_id: 2, year: 2024, narative: 'Other plan', ...timestamps },
];

// Deliberately inserted so that insertion (id) order differs from every column
// order, which lets the ordering assertions below be meaningful.
const scheduleEntries = [
  {
    id: 1,
    grazing_schedule_id: GRAZING_SCHEDULE_ID,
    pasture_id: 2,
    livestock_type_id: 2,
    livestock_count: 30,
    date_in: '2024-05-01T00:00:00.000Z',
    date_out: '2024-05-10T00:00:00.000Z',
    grace_days: 5,
    ...timestamps,
  },
  {
    id: 2,
    grazing_schedule_id: GRAZING_SCHEDULE_ID,
    pasture_id: 1,
    livestock_type_id: 1,
    livestock_count: 10,
    date_in: '2024-06-01T00:00:00.000Z',
    date_out: '2024-06-10T00:00:00.000Z',
    grace_days: 2,
    ...timestamps,
  },
  {
    id: 3,
    grazing_schedule_id: GRAZING_SCHEDULE_ID,
    pasture_id: 1,
    livestock_type_id: 3,
    livestock_count: 20,
    date_in: '2024-07-01T00:00:00.000Z',
    date_out: '2024-07-10T00:00:00.000Z',
    grace_days: 0,
    ...timestamps,
  },
];

const truncateTables = async () => {
  await dm.db.schema.raw(truncate('user_account'));
  await dm.db.schema.raw(truncate('ref_district'));
  await dm.db.schema.raw(truncate('ref_zone'));
  await dm.db.schema.raw(truncate('agreement'));
  await dm.db.schema.raw(truncate('plan'));
  await dm.db.schema.raw(truncate('pasture'));
  await dm.db.schema.raw(truncate('grazing_schedule'));
  await dm.db.schema.raw(truncate('grazing_schedule_entry'));
};

const setScheduleSort = (sortBy, sortOrder) =>
  dm.db.schema.raw(
    `UPDATE grazing_schedule SET sort_by = '${sortBy}', sort_order = '${sortOrder}' WHERE id = ${GRAZING_SCHEDULE_ID}`,
  );

const parseCsv = (text) =>
  text
    .trim()
    .split('\n')
    .map((line) => line.trim().split(','));

const columnValues = (rows, index) => rows.slice(1).map((row) => row[index]);

describe('Test Schedule CSV export route', () => {
  beforeAll(async () => {
    passport.aUser.isAgreementHolder = () => false;
    passport.aUser.isRangeOfficer = () => false;
    passport.aUser.isAdministrator = () => true;

    await truncateTables();
  });

  beforeEach(async () => {
    passport.aUser.canAccessAgreement = () => true;

    await dm.db('user_account').insert([userMocks[0]]);
    await dm.db('ref_district').insert(districtMocks);
    await dm.db('ref_zone').insert([zoneMocks[0]]);
    await dm.db('agreement').insert([agreement]);
    await dm.db('plan').insert(plans);
    await dm.db('pasture').insert(pastures);
    await dm.db('grazing_schedule').insert(schedules);
    await dm.db('grazing_schedule_entry').insert(scheduleEntries);
  });

  afterEach(async () => {
    passport.aUser.canAccessAgreement = canAccessAgreement;

    await truncateTables();
  });

  test('Exports a grazing schedule as CSV with the expected header row', async () => {
    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect('Content-Type', /text\/csv/)
      .expect((res) => {
        const rows = parseCsv(res.text);
        expect(rows[0]).toEqual([
          'RAN',
          'Year',
          'Pasture',
          'Livestock Type',
          'Number of Animals',
          'Date In',
          'Date Out',
          'Days',
          'Grace Days',
          'PLD AUMs',
          'Crown AUMs',
        ]);
        expect(rows).toHaveLength(scheduleEntries.length + 1);
      });
  });

  test('Sets a Content-Disposition attachment filename built from the RAN and year', async () => {
    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect('Content-Disposition', `attachment; filename="${AGREEMENT_ID}_2024_schedule.csv"`);
  });

  test('Includes the agreement id, year and entry values on every row', async () => {
    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect((res) => {
        const rows = parseCsv(res.text);
        expect(columnValues(rows, 0)).toEqual([AGREEMENT_ID, AGREEMENT_ID, AGREEMENT_ID]);
        expect(columnValues(rows, 1)).toEqual(['2024', '2024', '2024']);
        expect(columnValues(rows, 5)).toEqual(['2024-05-01', '2024-06-01', '2024-07-01']);
        expect(columnValues(rows, 6)).toEqual(['2024-05-10', '2024-06-10', '2024-07-10']);
        // dateOut - dateIn, inclusive
        expect(columnValues(rows, 7)).toEqual(['10', '10', '10']);
        expect(columnValues(rows, 8)).toEqual(['5', '2', '0']);
      });
  });

  test('Defaults to entry id order when the schedule has no persisted sort', async () => {
    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect((res) => {
        const rows = parseCsv(res.text);
        expect(columnValues(rows, 4)).toEqual(['30', '10', '20']);
      });
  });

  test('Preserves the persisted ascending sort order of the schedule', async () => {
    await setScheduleSort('livestock_count', 'asc');

    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect((res) => {
        const rows = parseCsv(res.text);
        expect(columnValues(rows, 4)).toEqual(['10', '20', '30']);
      });
  });

  test('Preserves the persisted descending sort order of the schedule', async () => {
    await setScheduleSort('livestock_count', 'desc');

    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect((res) => {
        const rows = parseCsv(res.text);
        expect(columnValues(rows, 4)).toEqual(['30', '20', '10']);
      });
  });

  test('Preserves a persisted sort on a joined pasture column', async () => {
    await setScheduleSort('pasture_name', 'asc');

    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect((res) => {
        const rows = parseCsv(res.text);
        expect(columnValues(rows, 2)).toEqual(['Alpha Pasture', 'Alpha Pasture', 'Bravo Pasture']);
      });
  });

  test('Exports a header-only CSV for a schedule with no entries', async () => {
    await dm.db.schema.raw(truncate('grazing_schedule_entry'));

    const app = await createApp();

    await request(app)
      .get(csvUrl(1, GRAZING_SCHEDULE_ID))
      .expect(200)
      .expect((res) => {
        expect(parseCsv(res.text)).toHaveLength(1);
      });
  });

  test('Returns 404 when the schedule belongs to a different plan', async () => {
    const app = await createApp();
    await request(app).get(csvUrl(1, OTHER_PLAN_SCHEDULE_ID)).expect(404);
  });

  test('Returns 404 for a nonexistant schedule', async () => {
    const app = await createApp();
    await request(app).get(csvUrl(1, 999)).expect(404);
  });

  test('Returns 403 when the user cannot access the agreement', async () => {
    passport.aUser.canAccessAgreement = () => false;

    const app = await createApp();
    await request(app).get(csvUrl(1, GRAZING_SCHEDULE_ID)).expect(403);
  });
});
