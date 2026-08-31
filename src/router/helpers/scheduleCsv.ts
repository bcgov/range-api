// @ts-nocheck
import { SCHEDULE_EXPORT, SCHEDULE_EXPORT_COLUMNS } from '../../constants.js';
import { calcCrownAUMs, calcDateDiff, calcPldAUMs, calcTotalAUMs, round } from './PDFHelper.js';

const C = SCHEDULE_EXPORT_COLUMNS;

/**
 * CSV cells must never be `null`/`undefined` or the `csv` stringifier emits the
 * literal string "null". Blank is the correct representation for "not provided".
 */
const cell = (value) => (value === null || value === undefined ? '' : value);

const numericCell = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isNaN(parsed) ? '' : parsed;
};

/**
 * Entries come off the joined query with the pasture/livestock columns aliased
 * and camel-cased (`pastureName`, `refLivestockName`). Older/plain shapes nest
 * them as objects, so accept both.
 */
const pastureName = (entry) => entry.pastureName ?? entry.pasture?.name ?? '';

const livestockTypeName = (entry) => entry.refLivestockName ?? entry.livestockType?.name ?? '';

const auFactor = (entry) => entry.refLivestockAuFactor ?? entry.livestockType?.auFactor ?? 0;

const pldPercent = (entry) => entry.pasturePldPercent ?? entry.pasture?.pldPercent ?? 0;

/**
 * Mirrors the AUM maths used by the schedule table and the PDF renderer so an
 * exported row always matches what the user sees on screen.
 */
export const calculateEntryAUMs = (entry) => {
  const days = Number(calcDateDiff(entry.dateOut, entry.dateIn, false));
  const totalAUMs = calcTotalAUMs(Number(entry.livestockCount) || 0, days, Number(auFactor(entry)) || 0);
  const pldAUMs = round(calcPldAUMs(totalAUMs, Number(pldPercent(entry)) || 0), 0);
  const crownAUMsWithDecimal = calcCrownAUMs(totalAUMs, pldAUMs);
  const crownAUMs = crownAUMsWithDecimal > 0 && crownAUMsWithDecimal < 1 ? 1 : round(crownAUMsWithDecimal, 0);

  return { days, pldAUMs, crownAUMs };
};

export const GRAZING_SCHEDULE_CSV_COLUMNS = [
  C.RAN,
  C.YEAR,
  C.PASTURE,
  C.LIVESTOCK_TYPE,
  C.NUM_OF_ANIMALS,
  C.DATE_IN,
  C.DATE_OUT,
  C.DAYS,
  C.GRACE_DAYS,
  C.PLD_AUMS,
  C.CROWN_AUMS,
];

export const HAY_CUTTING_SCHEDULE_CSV_COLUMNS = [
  C.RAN,
  C.YEAR,
  C.AREA,
  C.AVERAGE_HEIGHT,
  C.PERIOD_START,
  C.PERIOD_END,
  C.TONNES,
];

/**
 * Builds one CSV row per schedule entry, preserving the order of
 * `scheduleEntries` exactly as it was supplied. The caller is responsible for
 * fetching entries in the schedule's persisted sort order; this function must
 * never re-sort.
 */
export const buildGrazingScheduleCsvRows = ({ agreementId, year, scheduleEntries = [] }) =>
  scheduleEntries.map((entry) => {
    const { days, pldAUMs, crownAUMs } = calculateEntryAUMs(entry);

    return {
      [C.RAN]: cell(agreementId),
      [C.YEAR]: cell(year),
      [C.PASTURE]: cell(pastureName(entry)),
      [C.LIVESTOCK_TYPE]: cell(livestockTypeName(entry)),
      [C.NUM_OF_ANIMALS]: numericCell(entry.livestockCount),
      [C.DATE_IN]: cell(entry.dateIn),
      [C.DATE_OUT]: cell(entry.dateOut),
      [C.DAYS]: days,
      [C.GRACE_DAYS]: numericCell(entry.graceDays),
      [C.PLD_AUMS]: pldAUMs,
      [C.CROWN_AUMS]: crownAUMs,
    };
  });

export const buildHayCuttingScheduleCsvRows = ({ agreementId, year, scheduleEntries = [] }) =>
  scheduleEntries.map((entry) => ({
    [C.RAN]: cell(agreementId),
    [C.YEAR]: cell(year),
    [C.AREA]: cell(pastureName(entry)),
    [C.AVERAGE_HEIGHT]: numericCell(entry.stubbleHeight),
    [C.PERIOD_START]: cell(entry.dateIn),
    [C.PERIOD_END]: cell(entry.dateOut),
    [C.TONNES]: numericCell(entry.tonnes),
  }));

export const buildScheduleCsv = ({ agreementId, schedule, isHayCutting }) => {
  const args = {
    agreementId,
    year: schedule?.year,
    scheduleEntries: schedule?.scheduleEntries || [],
  };

  return isHayCutting
    ? { columns: HAY_CUTTING_SCHEDULE_CSV_COLUMNS, rows: buildHayCuttingScheduleCsvRows(args) }
    : { columns: GRAZING_SCHEDULE_CSV_COLUMNS, rows: buildGrazingScheduleCsvRows(args) };
};

/**
 * Produces a filesystem-safe download name, e.g. `RAN075974_2024_schedule.csv`.
 */
export const buildScheduleCsvFilename = (agreementId, year) => {
  const safeAgreementId = String(agreementId ?? '').replace(/[^a-zA-Z0-9-_]/g, '') || 'plan';
  const safeYear = String(year ?? '').replace(/[^0-9]/g, '');
  const parts = [safeAgreementId, safeYear, SCHEDULE_EXPORT.FILENAME_PREFIX].filter(Boolean);

  return `${parts.join('_')}.csv`;
};
