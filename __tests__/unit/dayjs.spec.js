import { describe, it, expect, beforeAll } from 'vitest';

describe('dayjs', () => {
  let dayjs;

  beforeAll(async () => {
    dayjs = (await import('dayjs')).default;
    const isBetween = (await import('dayjs/plugin/isBetween.js')).default;
    const advancedFormat = (await import('dayjs/plugin/advancedFormat.js')).default;
    dayjs.extend(isBetween);
    dayjs.extend(advancedFormat);
  });

  it('formats dates', () => {
    const d = dayjs('2024-03-15');
    expect(d.format('MMM DD, YYYY')).toBe('Mar 15, 2024');
    expect(d.format('MMMM D')).toBe('March 15');
  });

  it('formats with ordinal Do', () => {
    const d = dayjs('2024-03-15');
    expect(d.format('MMMM Do')).toBe('March 15th');
  });

  it('startOf day works', () => {
    const d = dayjs('2024-03-15T14:30:00').startOf('day');
    expect(d.format('HH:mm')).toBe('00:00');
  });

  it('diff works', () => {
    const a = dayjs('2024-03-20');
    const b = dayjs('2024-03-15');
    expect(a.diff(b, 'days')).toBe(5);
  });

  it('set works', () => {
    const d = dayjs().set('month', 2).set('date', 15);
    expect(d.month()).toBe(2);
    expect(d.date()).toBe(15);
  });

  it('isSame works', () => {
    expect(dayjs('2024-03-15').isSame(dayjs('2024-03-15'))).toBe(true);
    expect(dayjs('2024-03-15').isSame(dayjs('2024-03-16'))).toBe(false);
  });

  it('isBefore works', () => {
    expect(dayjs('2024-03-14').isBefore(dayjs('2024-03-15'))).toBe(true);
    expect(dayjs('2024-03-15').isBefore(dayjs('2024-03-14'))).toBe(false);
  });

  it('isAfter works', () => {
    expect(dayjs('2024-03-16').isAfter(dayjs('2024-03-15'))).toBe(true);
    expect(dayjs('2024-03-15').isAfter(dayjs('2024-03-16'))).toBe(false);
  });

  it('isBetween works with plugin', () => {
    const start = dayjs('2024-03-10');
    const end = dayjs('2024-03-20');
    const today = dayjs('2024-03-15');
    expect(today.isBetween(start, end, null, '[]')).toBe(true);
    expect(dayjs('2024-03-09').isBetween(start, end, null, '[]')).toBe(false);
    expect(dayjs('2024-03-10').isBetween(start, end, null, '[]')).toBe(true);
    expect(dayjs('2024-03-20').isBetween(start, end, null, '[]')).toBe(true);
  });
});
