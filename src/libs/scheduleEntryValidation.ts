// @ts-nocheck
import { errorWithCode } from './bcgov-shim.js';

/**
 * Extract the calendar year (UTC) that a schedule entry date value falls in.
 *
 * Shared by PlanScheduleController (schedule create/update) and Plan.restoreVersion
 * (snapshot restore), so both entry points into schedule-entry persistence agree on
 * what "the year" of a date means.
 */
export function extractYearFromScheduleDate(dateValue) {
  if (typeof dateValue === 'string') {
    const datePrefixMatch = dateValue.match(/^(\d{4})-\d{2}-\d{2}/);
    if (datePrefixMatch) {
      return Number(datePrefixMatch[1]);
    }
  }

  return new Date(dateValue).getUTCFullYear();
}

/**
 * Throws if any schedule entry's dateIn falls outside the given schedule year.
 *
 * Guards every code path that persists grazing/hay-cutting schedule entries —
 * including paths that bypass PlanScheduleController (e.g. Plan.restoreVersion
 * re-creating entries from a historical plan_snapshot) — so stale bad data
 * from old snapshots can't silently re-enter the live tables.
 */
export function validateEntryDates(scheduleEntries, scheduleYear) {
  (scheduleEntries || []).forEach((entry) => {
    if (entry.dateIn) {
      const entryYear = extractYearFromScheduleDate(entry.dateIn);
      if (entryYear !== scheduleYear) {
        throw errorWithCode('Schedule entry date(s) must be within the schedule year.', 400);
      }
    }
  });
}

export default { extractYearFromScheduleDate, validateEntryDates };
