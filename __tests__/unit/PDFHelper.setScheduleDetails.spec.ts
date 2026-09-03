import { AdditionalDetailsGenerator, calcCrownTotalAUMs } from '../../src/router/helpers/PDFHelper.js';

/**
 * Characterization tests for `AdditionalDetailsGenerator.setScheduleDetails`.
 *
 * This method had no test coverage, yet it is the code that produces the AUM
 * numbers printed on the PDF. It mutates the `plan` object in place, and that
 * mutated object is exactly what gets handed to CDOGS to render. So asserting
 * on the object after the call is both deterministic and a faithful proxy for
 * "what appears in the document" - stronger than diffing a generated binary,
 * which would carry font and timestamp noise.
 *
 * These tests pin the CURRENT behaviour, quirks included. They exist so that
 * consolidating the AUM maths into src/libs/aumCalculation.ts cannot change a
 * single number on the PDF without turning something red.
 *
 * NOTE the field names asserted below are SINGULAR (`pldAUM`, `crownAUM`,
 * `crownTotalAUM`). That is not a typo: planTemplate_GrazingSchedule.docx
 * binds `{$se[i].pldAUM}` and `{$s[i].crownTotalAUM}`. Renaming them to match
 * the plural names used elsewhere in the codebase would silently blank out the
 * PDF, so these assertions are load-bearing.
 */

const GRAZING = { id: 1, description: 'Grazing' };
const HAY_CUTTING = { id: 3, description: 'Hay Cutting' };

const buildPlan = ({ agreementType, pastures, schedules, usage = [] }) => ({
  agreement: { agreementType, usage },
  pastures,
  schedules,
});

describe('AdditionalDetailsGenerator.setScheduleDetails', () => {
  let generator;

  beforeEach(() => {
    generator = new AdditionalDetailsGenerator();
  });

  describe('grazing schedules', () => {
    it('sets the singular AUM field names the docx template binds', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'North Pasture', pldPercent: 0.5, graceDays: 5 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 100,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      const entry = plan.schedules[0].scheduleEntries[0];

      expect(entry).toMatchObject({
        pasture: 'North Pasture',
        days: 30,
        auFactor: 0.6,
        totalAUM: (100 * 30 * 0.6) / 30.44,
        pldAUM: 30,
        crownAUM: 29,
      });
      expect(plan.schedules[0].crownTotalAUM).toBe(29);
    });

    it('accumulates crownTotalAUM across every entry in the schedule', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [
          { id: 10, name: 'North', pldPercent: 0, graceDays: 5 },
          { id: 11, name: 'South', pldPercent: 0, graceDays: 5 },
        ],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 100,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
              {
                pastureId: 11,
                livestockCount: 50,
                dateIn: '2024-06-01',
                dateOut: '2024-06-30',
                livestockType: { auFactor: 1 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      const [first, second] = plan.schedules[0].scheduleEntries;
      expect(first.crownAUM).toBe(59);
      expect(second.crownAUM).toBe(49);
      expect(plan.schedules[0].crownTotalAUM).toBe(108);
    });

    it('clamps a crown AUM between 0 and 1 up to 1 rather than rounding it to zero', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'Tiny', pldPercent: 0, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 1,
                dateIn: '2024-05-01',
                dateOut: '2024-05-01',
                livestockType: { auFactor: 0.1 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      const entry = plan.schedules[0].scheduleEntries[0];
      expect(entry.totalAUM).toBeLessThan(1);
      expect(entry.totalAUM).toBeGreaterThan(0);
      expect(entry.crownAUM).toBe(1);
    });

    it('still reports 1 crown AUM at 100 percent private land, because pld is rounded first', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'All Private', pldPercent: 1, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 100,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      // totalAUM is 59.13..., pldAUM rounds to 59, so the remainder is 0.13 -
      // which lands in the clamp window and is lifted to 1 rather than 0.
      // Surprising, but it is the current behaviour and is pinned here so the
      // refactor cannot change it.
      expect(plan.schedules[0].scheduleEntries[0].pldAUM).toBe(59);
      expect(plan.schedules[0].scheduleEntries[0].crownAUM).toBe(1);
      expect(plan.schedules[0].crownTotalAUM).toBe(1);
    });

    it('gives a crown AUM of zero only when there is no use at all', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'Unused', pldPercent: 0, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 0,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      expect(plan.schedules[0].scheduleEntries[0].crownAUM).toBe(0);
      expect(plan.schedules[0].crownTotalAUM).toBe(0);
    });

    it('rounds the pld AUM before subtracting it, so crown is derived from the rounded value', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'Mixed', pldPercent: 0.333, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 100,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      const entry = plan.schedules[0].scheduleEntries[0];
      const totalAUM = (100 * 30 * 0.6) / 30.44;

      expect(entry.pldAUM).toBe(Math.round(totalAUM * 0.333));
      expect(entry.crownAUM).toBe(Math.round(totalAUM - entry.pldAUM));
    });

    it('falls back to the pasture grace days when the entry has none', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'North', pldPercent: 0, graceDays: 7 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                graceDays: null,
                livestockCount: 10,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 1 },
              },
              {
                pastureId: 10,
                graceDays: 2,
                livestockCount: 10,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 1 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      expect(plan.schedules[0].scheduleEntries[0].graceDays).toBe(7);
      expect(plan.schedules[0].scheduleEntries[1].graceDays).toBe(2);
    });

    it('uses the N/A pasture label and zero PLD when the pasture is missing', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'North', pldPercent: 0.5, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 999,
                livestockCount: 100,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      expect(plan.schedules[0].scheduleEntries[0]).toMatchObject({
        pasture: 'N/A',
        totalAUM: (100 * 30 * 0.6) / 30.44,
        pldAUM: 0,
        crownAUM: 59,
      });
      expect(plan.schedules[0].crownTotalAUM).toBe(59);
    });
  });

  describe('hay cutting schedules', () => {
    it('derives the AUMs from tonnes and drops the pld field entirely', () => {
      const plan = buildPlan({
        agreementType: HAY_CUTTING,
        pastures: [{ id: 20, name: 'Hay Field', pldPercent: 0.5, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              { pastureId: 20, tonnes: 12.5, stubbleHeight: 10, dateIn: '2024-07-01', dateOut: '2024-07-15' },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      const entry = plan.schedules[0].scheduleEntries[0];

      expect(entry.pasture).toBe('Hay Field');
      expect(entry.totalAUM).toBe(12.5);
      expect(entry.crownAUM).toBe(12.5);
      expect(entry).not.toHaveProperty('pldAUM');
      expect(plan.schedules[0].crownTotalAUM).toBe(12.5);
    });

    it('formats the entry dates for display and marks missing ones N/A', () => {
      const plan = buildPlan({
        agreementType: HAY_CUTTING,
        pastures: [{ id: 20, name: 'Hay Field', pldPercent: 0, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              { pastureId: 20, tonnes: 1, dateIn: '2024-07-01', dateOut: '2024-07-15' },
              { pastureId: 20, tonnes: 1, dateIn: null, dateOut: null },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      const [withDates, withoutDates] = plan.schedules[0].scheduleEntries;
      expect(withDates.dateInFormatted).toBe('Jul 01, 2024');
      expect(withDates.dateOutFormatted).toBe('Jul 15, 2024');
      expect(withoutDates.dateInFormatted).toBe('N/A');
      expect(withoutDates.dateOutFormatted).toBe('N/A');
    });

    it('accumulates the untruncated tonnes but displays each entry rounded to one decimal', () => {
      const plan = buildPlan({
        agreementType: HAY_CUTTING,
        pastures: [{ id: 20, name: 'Hay Field', pldPercent: 0, graceDays: 0 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              { pastureId: 20, tonnes: 1.06, dateIn: '2024-07-01', dateOut: '2024-07-15' },
              { pastureId: 20, tonnes: 2.04, dateIn: '2024-08-01', dateOut: '2024-08-15' },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      const [first, second] = plan.schedules[0].scheduleEntries;
      expect(first.crownAUM).toBe(1.1);
      expect(second.crownAUM).toBe(2);
      // The total is summed before rounding, so it is not the sum of the
      // displayed values.
      expect(plan.schedules[0].crownTotalAUM).toBeCloseTo(3.1, 10);
    });

    it('treats a missing tonnes value as zero', () => {
      const plan = buildPlan({
        agreementType: HAY_CUTTING,
        pastures: [{ id: 20, name: 'Hay Field', pldPercent: 0, graceDays: 0 }],
        schedules: [{ year: 2024, scheduleEntries: [{ pastureId: 20, tonnes: null }] }],
      });

      generator.setScheduleDetails(plan);

      expect(plan.schedules[0].scheduleEntries[0].totalAUM).toBe(0);
      expect(plan.schedules[0].crownTotalAUM).toBe(0);
    });
  });

  describe('authorized use and percent use', () => {
    it('takes the authorized AUM from the usage row matching the schedule year', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'North', pldPercent: 0, graceDays: 0 }],
        usage: [
          { year: 2023, totalAnnualUse: 500 },
          { year: 2024, totalAnnualUse: 100 },
        ],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 100,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      expect(plan.schedules[0].authorizedAUM).toBe(100);
      expect(plan.schedules[0].crownTotalAUM).toBe(59);
      expect(plan.schedules[0].percentUse).toBe(59);
    });

    it('rounds percent use up, and lifts a sliver of use to 1 percent', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'North', pldPercent: 0, graceDays: 0 }],
        usage: [{ year: 2024, totalAnnualUse: 100000 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 1,
                dateIn: '2024-05-01',
                dateOut: '2024-05-01',
                livestockType: { auFactor: 0.1 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      expect(plan.schedules[0].crownTotalAUM).toBe(1);
      expect(plan.schedules[0].percentUse).toBe(1);
    });

    it('leaves percent use unset when there is no usage for the schedule year', () => {
      const plan = buildPlan({
        agreementType: GRAZING,
        pastures: [{ id: 10, name: 'North', pldPercent: 0, graceDays: 0 }],
        usage: [{ year: 2023, totalAnnualUse: 500 }],
        schedules: [
          {
            year: 2024,
            scheduleEntries: [
              {
                pastureId: 10,
                livestockCount: 100,
                dateIn: '2024-05-01',
                dateOut: '2024-05-30',
                livestockType: { auFactor: 0.6 },
              },
            ],
          },
        ],
      });

      generator.setScheduleDetails(plan);

      expect(plan.schedules[0].authorizedAUM).toBeUndefined();
      expect(plan.schedules[0].percentUse).toBeUndefined();
    });
  });
});

describe('calcCrownTotalAUMs', () => {
  it('sums the already-computed crown AUMs of the entries', () => {
    expect(calcCrownTotalAUMs([{ crownAUMs: 10 }, { crownAUMs: 25 }, { crownAUMs: 4 }])).toBe(39);
  });

  it('returns zero for an empty schedule', () => {
    expect(calcCrownTotalAUMs([])).toBe(0);
    expect(calcCrownTotalAUMs()).toBe(0);
  });
});
