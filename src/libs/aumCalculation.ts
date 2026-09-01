// @ts-nocheck
import { DAYS_ON_THE_AVERAGE } from '../constants.js';
import { dayjs as moment } from './bcgov-shim.js';

/**
 * Single source of truth for Animal Unit Month (AUM) maths.
 *
 * This module deliberately contains no I/O and no knowledge of its callers. It
 * exists because the same five-line calculation was previously written out
 * three separate times in this repo (the PDF generator, the grazing schedule
 * model, and the CSV exporter), each with subtly different null-guarding.
 *
 * IMPORTANT: this module returns *neutral* names (`pldAUMs`, `crownAUMs`).
 * Callers must assign them to whatever field names their consumer expects. In
 * particular the CDOGS template `planTemplate_GrazingSchedule.docx` binds the
 * SINGULAR `{$se[i].pldAUM}` / `{$se[i].crownAUM}` / `{$s[i].crownTotalAUM}`,
 * while the DB model and CSV export use the plural forms. Unifying those names
 * would silently blank out the PDF.
 */

const shift = (number, precision) => {
  const numArray = `${number}`.split('e');
  return +`${numArray[0]}e${numArray[1] ? +numArray[1] + precision : precision}`;
};

export const round = (number, precision) => shift(Math.round(shift(number, +precision)), -precision);

/**
 * @param {number} numberOfAnimals
 * @param {number} totalDays
 * @param {number} auFactor parameter provided from the livestock type
 * @returns {number} the total AUMs
 */
export const calcTotalAUMs = (numberOfAnimals = 0, totalDays, auFactor = 0) =>
  (numberOfAnimals * totalDays * auFactor) / DAYS_ON_THE_AVERAGE;

/**
 * Number of days between two dates, inclusive of both ends.
 *
 * @param {string | Date} first
 * @param {string | Date} second
 * @param {boolean} isUserFriendly when true, returns 'N/P' rather than 0 for missing dates
 * @returns {number | string}
 */
export const calcDateDiff = (first, second, isUserFriendly) => {
  if (first && second) {
    return moment(first).diff(moment(second), 'days') + 1;
  }
  return isUserFriendly ? 'N/P' : 0;
};

/**
 * Calculate Private Land Deduction Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {number} pasturePldPercent
 * @returns {number} the pld AUMs
 */
export const calcPldAUMs = (totalAUMs, pasturePldPercent = 0) => totalAUMs * pasturePldPercent;

/**
 * Calculate Crown Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {number} pldAUMs
 * @returns {number} the crown AUMs
 */
export const calcCrownAUMs = (totalAUMs, pldAUMs) => totalAUMs - pldAUMs;

/**
 * Sum the already-computed per-entry crown AUMs of a schedule.
 *
 * @param {Array} entries schedule entries carrying a `crownAUMs` field
 * @returns {number} the total crown AUMs
 */
export const calcCrownTotalAUMs = (entries = []) => {
  const reducer = (accumulator, currentValue) => accumulator + currentValue;
  if (entries.length === 0) {
    return 0;
  }
  return entries.map((entry) => entry.crownAUMs).reduce(reducer);
};

/**
 * Coerce a value that must participate in arithmetic into a finite number.
 *
 * The three original copies of this calculation guarded differently (`|| 0`,
 * `Number(x)`, or not at all). They agreed on every value actually present in
 * the database, and disagreed only on `undefined` / non-numeric input, where
 * the unguarded versions produced `NaN`. `NaN` is never a meaningful AUM — it
 * renders as "NaN" in the PDF — so the defensive guard is used everywhere.
 */
const toNumber = (value) => Number(value) || 0;

/**
 * The per-entry AUM calculation. This is the one definition.
 *
 * Behaviour is preserved exactly, quirks included:
 *  - `pldAUMs` is rounded to a whole number *before* being subtracted, so
 *    `crownAUMs` is derived from the rounded PLD rather than the raw one.
 *  - a crown value in the open interval (0, 1) is clamped up to 1, so that a
 *    pasture with real but tiny crown use never reports as zero.
 *
 * @param {{ dateIn, dateOut, livestockCount, auFactor, pldPercent }} inputs
 * @returns {{ days: number, totalAUMs: number, pldAUMs: number, crownAUMs: number }}
 */
export const computeAUMs = ({ dateIn, dateOut, livestockCount, auFactor, pldPercent }) => {
  const days = Number(calcDateDiff(dateOut, dateIn, false));
  const totalAUMs = calcTotalAUMs(toNumber(livestockCount), days, toNumber(auFactor));
  const pldAUMs = round(calcPldAUMs(totalAUMs, toNumber(pldPercent)), 0);
  const crownAUMsWithDecimal = calcCrownAUMs(totalAUMs, pldAUMs);
  const crownAUMs = crownAUMsWithDecimal > 0 && crownAUMsWithDecimal < 1 ? 1 : round(crownAUMsWithDecimal, 0);

  return { days, totalAUMs, pldAUMs, crownAUMs };
};

/**
 * Pull the calculation inputs off a schedule entry.
 *
 * Entries reach this code in three different shapes depending on the query
 * that produced them, so all three are accepted:
 *  - flat and camel-cased from the joined export query (`refLivestockAuFactor`)
 *  - flat and snake-cased straight off the row (`ref_livestock_au_factor`)
 *  - nested model objects (`livestockType.auFactor`, `pasture.pldPercent`)
 */
export const resolveEntryAUMInputs = (entry) => ({
  dateIn: entry.dateIn ?? entry.date_in,
  dateOut: entry.dateOut ?? entry.date_out,
  livestockCount: entry.livestockCount ?? entry.livestock_count,
  auFactor: entry.refLivestockAuFactor ?? entry.ref_livestock_au_factor ?? entry.livestockType?.auFactor,
  pldPercent: entry.pasturePldPercent ?? entry.pasture_pld_percent ?? entry.pasture?.pldPercent,
});

/**
 * Convenience wrapper: resolve an entry's inputs and compute its AUMs.
 */
export const calculateEntryAUMs = (entry) => computeAUMs(resolveEntryAUMInputs(entry));
