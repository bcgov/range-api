import {
  buildGrazingScheduleCsvRows,
  buildHayCuttingScheduleCsvRows,
  buildScheduleCsv,
  buildScheduleCsvFilename,
  calculateEntryAUMs,
  GRAZING_SCHEDULE_CSV_COLUMNS,
  HAY_CUTTING_SCHEDULE_CSV_COLUMNS,
} from '../../src/router/helpers/scheduleCsv.js';

const grazingEntry = (overrides = {}) => ({
  id: 1,
  pastureName: 'Pasture A',
  refLivestockName: 'Alpaca',
  refLivestockAuFactor: 0.2,
  pasturePldPercent: 0.5,
  livestockCount: 100,
  dateIn: '2024-05-01',
  dateOut: '2024-05-30',
  graceDays: 3,
  ...overrides,
});

const hayEntry = (overrides = {}) => ({
  id: 1,
  pastureName: 'Field A',
  stubbleHeight: 15,
  tonnes: 42,
  dateIn: '2024-06-01',
  dateOut: '2024-06-15',
  ...overrides,
});

describe('scheduleCsv: calculateEntryAUMs', () => {
  test('computes days inclusively and derives PLD/Crown AUMs', () => {
    expect(calculateEntryAUMs(grazingEntry())).toEqual({ days: 30, pldAUMs: 10, crownAUMs: 10 });
  });

  test('treats missing dates as zero days', () => {
    expect(calculateEntryAUMs(grazingEntry({ dateIn: null, dateOut: null }))).toEqual({
      days: 0,
      pldAUMs: 0,
      crownAUMs: 0,
    });
  });

  test('floors a fractional Crown AUM value between 0 and 1 up to 1', () => {
    const { crownAUMs } = calculateEntryAUMs(
      grazingEntry({ livestockCount: 1, refLivestockAuFactor: 0.5, pasturePldPercent: 0, dateOut: '2024-05-10' }),
    );
    expect(crownAUMs).toBe(1);
  });

  test('reads pasture and livestock data from nested objects when not aliased', () => {
    const entry = {
      livestockCount: 100,
      dateIn: '2024-05-01',
      dateOut: '2024-05-30',
      pasture: { name: 'Pasture A', pldPercent: 0.5 },
      livestockType: { name: 'Alpaca', auFactor: 0.2 },
    };
    expect(calculateEntryAUMs(entry)).toEqual({ days: 30, pldAUMs: 10, crownAUMs: 10 });
  });
});

describe('scheduleCsv: buildGrazingScheduleCsvRows', () => {
  test('maps an entry onto the grazing column set', () => {
    const rows = buildGrazingScheduleCsvRows({
      agreementId: 'RAN075974',
      year: 2024,
      scheduleEntries: [grazingEntry()],
    });

    expect(rows).toEqual([
      {
        RAN: 'RAN075974',
        Year: 2024,
        Pasture: 'Pasture A',
        'Livestock Type': 'Alpaca',
        'Number of Animals': 100,
        'Date In': '2024-05-01',
        'Date Out': '2024-05-30',
        Days: 30,
        'Grace Days': 3,
        'PLD AUMs': 10,
        'Crown AUMs': 10,
      },
    ]);
    expect(Object.keys(rows[0])).toEqual(GRAZING_SCHEDULE_CSV_COLUMNS);
  });

  test('preserves the supplied entry order rather than re-sorting', () => {
    const scheduleEntries = [
      grazingEntry({ id: 3, pastureName: 'Zulu' }),
      grazingEntry({ id: 1, pastureName: 'Alpha' }),
      grazingEntry({ id: 2, pastureName: 'Mike' }),
    ];

    const rows = buildGrazingScheduleCsvRows({ agreementId: 'RAN1', year: 2024, scheduleEntries });

    expect(rows.map((row) => row.Pasture)).toEqual(['Zulu', 'Alpha', 'Mike']);
  });

  test('renders missing values as blanks, never as null', () => {
    const rows = buildGrazingScheduleCsvRows({
      agreementId: 'RAN1',
      year: 2024,
      scheduleEntries: [
        grazingEntry({
          pastureName: null,
          refLivestockName: null,
          livestockCount: null,
          graceDays: null,
          dateIn: null,
          dateOut: null,
        }),
      ],
    });

    expect(rows[0]).toMatchObject({
      Pasture: '',
      'Livestock Type': '',
      'Number of Animals': '',
      'Date In': '',
      'Date Out': '',
      'Grace Days': '',
    });
    expect(Object.values(rows[0]).some((value) => value === null || value === undefined)).toBe(false);
  });

  test('returns no rows for an empty schedule', () => {
    expect(buildGrazingScheduleCsvRows({ agreementId: 'RAN1', year: 2024, scheduleEntries: [] })).toEqual([]);
    expect(buildGrazingScheduleCsvRows({ agreementId: 'RAN1', year: 2024 })).toEqual([]);
  });
});

describe('scheduleCsv: buildHayCuttingScheduleCsvRows', () => {
  test('maps an entry onto the hay cutting column set', () => {
    const rows = buildHayCuttingScheduleCsvRows({
      agreementId: 'RAN075974',
      year: 2024,
      scheduleEntries: [hayEntry()],
    });

    expect(rows).toEqual([
      {
        RAN: 'RAN075974',
        Year: 2024,
        Area: 'Field A',
        'Average Height (cm)': 15,
        'Period Start': '2024-06-01',
        'Period End': '2024-06-15',
        Tonnes: 42,
      },
    ]);
    expect(Object.keys(rows[0])).toEqual(HAY_CUTTING_SCHEDULE_CSV_COLUMNS);
  });

  test('preserves the supplied entry order', () => {
    const scheduleEntries = [hayEntry({ tonnes: 30 }), hayEntry({ tonnes: 10 }), hayEntry({ tonnes: 20 })];
    const rows = buildHayCuttingScheduleCsvRows({ agreementId: 'RAN1', year: 2024, scheduleEntries });

    expect(rows.map((row) => row.Tonnes)).toEqual([30, 10, 20]);
  });
});

describe('scheduleCsv: buildScheduleCsv', () => {
  test('selects the grazing shape by default', () => {
    const { columns, rows } = buildScheduleCsv({
      agreementId: 'RAN1',
      schedule: { year: 2024, scheduleEntries: [grazingEntry()] },
      isHayCutting: false,
    });

    expect(columns).toEqual(GRAZING_SCHEDULE_CSV_COLUMNS);
    expect(rows).toHaveLength(1);
  });

  test('selects the hay cutting shape when the agreement is hay cutting', () => {
    const { columns, rows } = buildScheduleCsv({
      agreementId: 'RAN1',
      schedule: { year: 2024, scheduleEntries: [hayEntry()] },
      isHayCutting: true,
    });

    expect(columns).toEqual(HAY_CUTTING_SCHEDULE_CSV_COLUMNS);
    expect(rows[0].Tonnes).toBe(42);
  });

  test('tolerates a schedule with no entries', () => {
    expect(buildScheduleCsv({ agreementId: 'RAN1', schedule: { year: 2024 }, isHayCutting: false }).rows).toEqual([]);
  });
});

describe('scheduleCsv: buildScheduleCsvFilename', () => {
  test('combines agreement id and year', () => {
    expect(buildScheduleCsvFilename('RAN075974', 2024)).toBe('RAN075974_2024_schedule.csv');
  });

  test('strips characters that are unsafe in a filename', () => {
    expect(buildScheduleCsvFilename('RAN/07"5974', 2024)).toBe('RAN075974_2024_schedule.csv');
  });

  test('falls back when the agreement id is missing', () => {
    expect(buildScheduleCsvFilename(null, null)).toBe('plan_schedule.csv');
  });
});
