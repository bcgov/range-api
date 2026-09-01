import { dayjs as moment } from '../../src/libs/bcgov-shim.js';
import { DAYS_ON_THE_AVERAGE } from '../../src/constants.js';
import { computeAUMs, calculateEntryAUMs, resolveEntryAUMInputs } from '../../src/libs/aumCalculation.js';

/**
 * Differential test for the AUM calculation refactor.
 *
 * The three blocks below are copies of the implementations that existed in
 * PDFHelper.ts, grazingschedule.ts and scheduleCsv.ts *before* they were
 * consolidated into src/libs/aumCalculation.ts. They are intentionally
 * duplicated here rather than imported: the whole point is to compare the new
 * single definition against what the code used to do.
 *
 * If any of these ever needs to change to make a test pass, the refactor is
 * wrong.
 */

// --- primitives, exactly as they were in PDFHelper.ts -----------------------

const origShift = (number, precision) => {
  const numArray = `${number}`.split('e');
  return +`${numArray[0]}e${numArray[1] ? +numArray[1] + precision : precision}`;
};

const origRound = (number, precision) => origShift(Math.round(origShift(number, +precision)), -precision);

const origCalcTotalAUMs = (numberOfAnimals = 0, totalDays, auFactor = 0) =>
  (numberOfAnimals * totalDays * auFactor) / DAYS_ON_THE_AVERAGE;

const origCalcDateDiff = (first, second, isUserFriendly) => {
  if (first && second) {
    return moment(first).diff(moment(second), 'days') + 1;
  }
  return isUserFriendly ? 'N/P' : 0;
};

const origCalcPldAUMs = (totalAUMs, pasturePldPercent = 0) => totalAUMs * pasturePldPercent;

const origCalcCrownAUMs = (totalAUMs, pldAUMs) => totalAUMs - pldAUMs;

// --- reference implementation 1: PDFHelper.setScheduleDetails --------------
// Unguarded: relies on default parameters, so `undefined` becomes 0 but a
// non-numeric string yields NaN.

const referencePdfHelper = ({ dateIn, dateOut, livestockCount, auFactor, pldPercent }) => {
  const days = origCalcDateDiff(dateOut, dateIn, false);
  const totalAUM = origCalcTotalAUMs(livestockCount, days, auFactor);
  const pldAUM = origRound(origCalcPldAUMs(totalAUM, pldPercent), 0);
  const crownAUMWithDecimal = origCalcCrownAUMs(totalAUM, pldAUM);
  const crownAUM = crownAUMWithDecimal > 0 && crownAUMWithDecimal < 1 ? 1 : origRound(crownAUMWithDecimal, 0);
  return { days: Number(days), totalAUMs: totalAUM, pldAUMs: pldAUM, crownAUMs: crownAUM };
};

// --- reference implementation 2: grazingschedule.fetchGrazingSchedulesEntries
// Coerces with bare Number(), so `undefined` becomes NaN.

const referenceGrazingSchedule = ({ dateIn, dateOut, livestockCount, auFactor, pldPercent }) => {
  const days = origCalcDateDiff(dateOut, dateIn, false);
  const totalAUMs = origCalcTotalAUMs(livestockCount, Number(days), Number(auFactor));
  const pldAUMs = origRound(origCalcPldAUMs(totalAUMs, pldPercent), 0);
  const crownAUMWithDecimal = origCalcCrownAUMs(totalAUMs, pldAUMs);
  const crownAUMs = crownAUMWithDecimal > 0 && crownAUMWithDecimal < 1 ? 1 : origRound(crownAUMWithDecimal, 0);
  return { days: Number(days), totalAUMs, pldAUMs, crownAUMs };
};

// --- reference implementation 3: scheduleCsv.calculateEntryAUMs ------------
// Fully guarded with `Number(x) || 0`.

const referenceScheduleCsv = ({ dateIn, dateOut, livestockCount, auFactor, pldPercent }) => {
  const days = Number(origCalcDateDiff(dateOut, dateIn, false));
  const totalAUMs = origCalcTotalAUMs(Number(livestockCount) || 0, days, Number(auFactor) || 0);
  const pldAUMs = origRound(origCalcPldAUMs(totalAUMs, Number(pldPercent) || 0), 0);
  const crownAUMsWithDecimal = origCalcCrownAUMs(totalAUMs, pldAUMs);
  const crownAUMs = crownAUMsWithDecimal > 0 && crownAUMsWithDecimal < 1 ? 1 : origRound(crownAUMsWithDecimal, 0);
  return { days, totalAUMs, pldAUMs, crownAUMs };
};

const REFERENCES = {
  PDFHelper: referencePdfHelper,
  grazingschedule: referenceGrazingSchedule,
  scheduleCsv: referenceScheduleCsv,
};

// --- input matrix ----------------------------------------------------------

/**
 * Inputs that actually occur: every column is populated with a sane value.
 * On these, all three old implementations and the new one must agree exactly.
 */
const realisticInputs = [];
const dates = [
  ['2024-05-01', '2024-05-30'],
  ['2024-05-01', '2024-05-01'], // single day
  ['2024-01-01', '2024-12-31'], // full year
  ['2024-02-28', '2024-03-01'], // leap day boundary
  ['2024-05-30', '2024-05-01'], // dateOut before dateIn -> negative days
];
const counts = [0, 1, 7, 100, 3500, 100000];
const auFactors = [0, 0.2, 0.6, 1, 1.5];
const pldPercents = [0, 0.001, 0.05, 0.5, 0.9999, 1];

for (const [dateIn, dateOut] of dates) {
  for (const livestockCount of counts) {
    for (const auFactor of auFactors) {
      for (const pldPercent of pldPercents) {
        realisticInputs.push({ dateIn, dateOut, livestockCount, auFactor, pldPercent });
      }
    }
  }
}

const base = {
  dateIn: '2024-05-01',
  dateOut: '2024-05-30',
  livestockCount: 100,
  auFactor: 0.6,
  pldPercent: 0.5,
};

/**
 * Degenerate inputs: missing, null, blank and non-numeric values, plus the
 * boundaries of the two quirks (the 0 < x < 1 crown clamp and round()'s
 * half-way case).
 */
const degenerateInputs = [
  // missing / null / blank dates
  { ...base, dateIn: null },
  { ...base, dateOut: null },
  { ...base, dateIn: undefined, dateOut: undefined },
  { ...base, dateIn: '' },
  // livestock count
  { ...base, livestockCount: null },
  { ...base, livestockCount: undefined },
  { ...base, livestockCount: '' },
  { ...base, livestockCount: '250' },
  { ...base, livestockCount: 'not-a-number' },
  // au factor
  { ...base, auFactor: null },
  { ...base, auFactor: undefined },
  { ...base, auFactor: '' },
  { ...base, auFactor: '0.6' },
  { ...base, auFactor: 'not-a-number' },
  // pld percent
  { ...base, pldPercent: null },
  { ...base, pldPercent: undefined },
  { ...base, pldPercent: '' },
  { ...base, pldPercent: '0.5' },
  { ...base, pldPercent: 'not-a-number' },
  // everything missing at once
  { dateIn: undefined, dateOut: undefined, livestockCount: undefined, auFactor: undefined, pldPercent: undefined },
];

/**
 * Inputs engineered to land inside the crown clamp window (0, 1), and inputs
 * that land exactly on a .5 rounding boundary.
 */
const clampAndRoundingInputs = [
  // one animal, one day, tiny factor -> crown well under 1, must clamp to 1
  { dateIn: '2024-05-01', dateOut: '2024-05-01', livestockCount: 1, auFactor: 0.1, pldPercent: 0 },
  { dateIn: '2024-05-01', dateOut: '2024-05-01', livestockCount: 1, auFactor: 1, pldPercent: 0 },
  { dateIn: '2024-05-01', dateOut: '2024-05-02', livestockCount: 1, auFactor: 1, pldPercent: 0 },
  // pld takes almost all of it -> crown lands in the clamp window
  { dateIn: '2024-05-01', dateOut: '2024-05-30', livestockCount: 100, auFactor: 0.6, pldPercent: 0.99 },
  // exact zero crown -> must NOT clamp, stays 0
  { dateIn: '2024-05-01', dateOut: '2024-05-30', livestockCount: 100, auFactor: 0.6, pldPercent: 1 },
  // zero total -> stays 0
  { dateIn: '2024-05-01', dateOut: '2024-05-30', livestockCount: 0, auFactor: 0.6, pldPercent: 0.5 },
  // half-way rounding: 30.44 days * count * factor tuned near x.5
  { dateIn: '2024-01-01', dateOut: '2024-01-31', livestockCount: 1, auFactor: 0.5, pldPercent: 0.5 },
  { dateIn: '2024-01-01', dateOut: '2024-02-15', livestockCount: 3, auFactor: 0.5, pldPercent: 0.5 },
  { dateIn: '2024-01-01', dateOut: '2024-01-16', livestockCount: 1, auFactor: 1, pldPercent: 0.5 },
];

const describeInput = (input) => JSON.stringify(input, (_key, value) => (value === undefined ? '<undefined>' : value));

describe('AUM calculation differential test', () => {
  describe('realistic inputs: new implementation is identical to all three originals', () => {
    it(`matches on all ${realisticInputs.length} fully-populated input combinations`, () => {
      const mismatches = [];

      for (const input of realisticInputs) {
        const actual = computeAUMs(input);
        for (const [name, reference] of Object.entries(REFERENCES)) {
          const expected = reference(input);
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            mismatches.push({ reference: name, input: describeInput(input), expected, actual });
          }
        }
      }

      expect(mismatches).toEqual([]);
    });

    it('matches on the crown clamp and rounding boundary cases', () => {
      const mismatches = [];

      for (const input of clampAndRoundingInputs) {
        const actual = computeAUMs(input);
        for (const [name, reference] of Object.entries(REFERENCES)) {
          const expected = reference(input);
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            mismatches.push({ reference: name, input: describeInput(input), expected, actual });
          }
        }
      }

      expect(mismatches).toEqual([]);
    });
  });

  describe('degenerate inputs', () => {
    /**
     * The old scheduleCsv implementation was the fully-guarded one, and the new
     * shared implementation adopts its guarding. So on every input, degenerate
     * or not, the two must agree exactly.
     */
    it('is identical to the scheduleCsv original on every degenerate input', () => {
      const mismatches = [];

      for (const input of degenerateInputs) {
        const actual = computeAUMs(input);
        const expected = referenceScheduleCsv(input);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          mismatches.push({ input: describeInput(input), expected, actual });
        }
      }

      expect(mismatches).toEqual([]);
    });

    /**
     * The PDFHelper and grazingschedule originals were less defensive. Where
     * they differ from the new implementation, the difference must be confined
     * to inputs on which the *old* code produced NaN — i.e. the new code only
     * ever replaces a broken number with a real one, and never changes a value
     * that was already valid.
     */
    it.each(['PDFHelper', 'grazingschedule'])(
      'only differs from the %s original where the original produced NaN',
      (referenceName) => {
        const reference = REFERENCES[referenceName];
        const unexplainedDifferences = [];
        const nanCasesFixed = [];

        for (const input of degenerateInputs) {
          const actual = computeAUMs(input);
          const expected = reference(input);

          for (const field of ['days', 'totalAUMs', 'pldAUMs', 'crownAUMs']) {
            if (Object.is(actual[field], expected[field])) continue;

            if (Number.isNaN(expected[field])) {
              nanCasesFixed.push({ input: describeInput(input), field });
            } else {
              unexplainedDifferences.push({
                input: describeInput(input),
                field,
                expected: expected[field],
                actual: actual[field],
              });
            }
          }
        }

        expect(unexplainedDifferences).toEqual([]);
        // Guard against this test silently becoming vacuous.
        expect(nanCasesFixed.length).toBeGreaterThan(0);
      },
    );

    it('never produces NaN, for any input in the matrix', () => {
      const nanResults = [];

      for (const input of [...realisticInputs, ...degenerateInputs, ...clampAndRoundingInputs]) {
        const result = computeAUMs(input);
        for (const [field, value] of Object.entries(result)) {
          if (Number.isNaN(value)) {
            nanResults.push({ input: describeInput(input), field });
          }
        }
      }

      expect(nanResults).toEqual([]);
    });
  });

  describe('entry shape resolution', () => {
    const expected = computeAUMs({
      dateIn: '2024-05-01',
      dateOut: '2024-05-30',
      livestockCount: 100,
      auFactor: 0.2,
      pldPercent: 0.5,
    });

    it('reads the flat camel-cased shape from the joined export query', () => {
      expect(
        calculateEntryAUMs({
          dateIn: '2024-05-01',
          dateOut: '2024-05-30',
          livestockCount: 100,
          refLivestockAuFactor: 0.2,
          pasturePldPercent: 0.5,
        }),
      ).toEqual(expected);
    });

    it('reads the flat snake-cased shape straight off the row', () => {
      expect(
        calculateEntryAUMs({
          date_in: '2024-05-01',
          date_out: '2024-05-30',
          livestock_count: 100,
          ref_livestock_au_factor: 0.2,
          pasture_pld_percent: 0.5,
        }),
      ).toEqual(expected);
    });

    it('reads the nested model shape', () => {
      expect(
        calculateEntryAUMs({
          dateIn: '2024-05-01',
          dateOut: '2024-05-30',
          livestockCount: 100,
          livestockType: { auFactor: 0.2 },
          pasture: { pldPercent: 0.5 },
        }),
      ).toEqual(expected);
    });

    it('prefers the flat aliased columns over the nested objects when both are present', () => {
      const inputs = resolveEntryAUMInputs({
        refLivestockAuFactor: 0.2,
        livestockType: { auFactor: 999 },
        pasturePldPercent: 0.5,
        pasture: { pldPercent: 999 },
      });

      expect(inputs.auFactor).toBe(0.2);
      expect(inputs.pldPercent).toBe(0.5);
    });

    it('treats a zero pld percent as zero rather than falling through to the nested value', () => {
      const inputs = resolveEntryAUMInputs({
        pasturePldPercent: 0,
        pasture: { pldPercent: 0.75 },
      });

      expect(inputs.pldPercent).toBe(0);
    });
  });
});
