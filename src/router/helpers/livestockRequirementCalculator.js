//
// Calculate maximum livestock requirements for a Range Use Plan
// by finding the peak concurrent usage across all date ranges
//

'use strict';

/**
 * Calculate maximum concurrent livestock requirements for each type
 * @param {Array} scheduleEntries - Array of schedule entries with livestock_count, date_in, date_out, livestock_type_id
 * @returns {Object} - Object with livestock_type_id as key and max concurrent count as value
 */
export function calculateMaxLivestock(scheduleEntries) {
  if (!scheduleEntries || scheduleEntries.length === 0) {
    return {};
  }
  const maxByType = {};

  // Group entries by livestock type
  const grouped = scheduleEntries.reduce((acc, entry) => {
    // Try different property names
    const typeId = entry.livestock_type_id || entry.livestockTypeId || entry.ref_livestock_id;

    if (!acc[typeId]) {
      acc[typeId] = [];
    }
    acc[typeId].push(entry);
    return acc;
  }, {});

  // For each livestock type, calculate peak concurrent usage
  Object.entries(grouped).forEach(([typeId, entries]) => {
    // Create events for timeline: {date, delta}
    const events = [];
    entries.forEach((entry) => {
      const count = entry.livestock_count || entry.livestockCount;
      const dateIn = entry.date_in || entry.dateIn;
      const dateOut = entry.date_out || entry.dateOut;

      // Add event when livestock enters
      events.push({
        date: new Date(dateIn).getTime(),
        delta: count,
      });
      // Add event when livestock exits
      events.push({
        date: new Date(dateOut).getTime(),
        delta: -count,
      });
    });

    // Sort events by date
    events.sort((a, b) => a.date - b.date);

    // Calculate running total and track maximum
    let current = 0;
    let max = 0;
    events.forEach((event) => {
      current += event.delta;
      max = Math.max(max, current);
    });

    maxByType[typeId] = max;
  });

  return maxByType;
}

/**
 * Get all schedule entries from a plan (both grazing and hay cutting)
 * for the current year
 * @param {Object} plan - Plan object with schedules
 * @returns {Array} - Flattened array of all schedule entries for the current year
 */
export function getAllScheduleEntries(plan) {
  if (!plan || !plan.schedules) {
    return [];
  }
  const allEntries = [];
  plan.schedules.forEach((schedule) => {
    if (schedule.scheduleEntries) {
      allEntries.push(...schedule.scheduleEntries);
    }
  });
  return allEntries;
}
