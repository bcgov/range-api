import { describe, it, expect } from 'vitest';

function validateEntryDates(scheduleEntries, scheduleYear) {
  scheduleEntries.forEach((entry) => {
    if (entry.dateIn) {
      const entryYear = new Date(entry.dateIn).getFullYear();
      if (entryYear !== scheduleYear) {
        const err = new Error('Schedule entry date(s) must be within the schedule year.');
        err.code = 400;
        throw err;
      }
    }
  });
}

describe('validateEntryDates', () => {
  it('should not throw when entry date matches schedule year', () => {
    const entries = [{ dateIn: '2025-06-01T07:00:00.000Z', dateOut: '2025-06-15T07:00:00.000Z' }];
    expect(() => validateEntryDates(entries, 2025)).not.toThrow();
  });

  it('should throw when entry date year differs from schedule year', () => {
    const entries = [{ dateIn: '2023-06-01T07:00:00.000Z', dateOut: '2023-06-15T07:00:00.000Z' }];
    expect(() => validateEntryDates(entries, 2025)).toThrow('Schedule entry date(s) must be within the schedule year.');
  });

  it('should not throw when entry has no dateIn', () => {
    const entries = [{ pastureId: 1, livestockCount: 100 }];
    expect(() => validateEntryDates(entries, 2025)).not.toThrow();
  });

  it('should validate all entries, not just the first', () => {
    const entries = [{ dateIn: '2025-06-01T07:00:00.000Z' }, { dateIn: '2023-06-01T07:00:00.000Z' }];
    expect(() => validateEntryDates(entries, 2025)).toThrow();
  });

  it('should accept multiple entries all with correct year', () => {
    const entries = [
      { dateIn: '2025-06-01T07:00:00.000Z' },
      { dateIn: '2025-08-15T07:00:00.000Z' },
      { dateIn: '2025-10-01T07:00:00.000Z' },
    ];
    expect(() => validateEntryDates(entries, 2025)).not.toThrow();
  });

  it('should work with date-only strings (no time component)', () => {
    const entries = [{ dateIn: '2025-06-01' }];
    expect(() => validateEntryDates(entries, 2025)).not.toThrow();
  });

  it('should throw with error code 400', () => {
    const entries = [{ dateIn: '2023-06-01' }];
    try {
      validateEntryDates(entries, 2025);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.code).toBe(400);
    }
  });
});
