import { describe, expect, it } from 'vitest';
import { changeAuditMetadata, changedValues, diffFields, hasChanges, isSameValue } from '../../src/libs/fieldChanges';

describe('fieldChanges', () => {
  it('treats pg-returned values as equal to the equivalent job values', () => {
    expect(isSameValue(new Date('2020-01-01T08:00:00Z'), new Date('2020-01-01T08:00:00.000Z'))).toBe(true);
    expect(isSameValue('45.50', 45.5)).toBe(true);
    expect(isSameValue(1, 1)).toBe(true);
    expect(isSameValue(undefined, null)).toBe(true);
    expect(isSameValue(['02', '01'], ['01', '02'])).toBe(true);
    expect(isSameValue(false, false)).toBe(true);
  });

  it('detects real differences', () => {
    expect(isSameValue(new Date('2020-01-01T08:00:00Z'), new Date('2020-01-02T08:00:00Z'))).toBe(false);
    expect(isSameValue(null, 0)).toBe(false);
    expect(isSameValue(0, null)).toBe(false);
    expect(isSameValue('45.5', 46)).toBe(false);
    expect(isSameValue(['01'], ['01', '02'])).toBe(false);
    expect(isSameValue(true, false)).toBe(false);
    expect(isSameValue(new Date('invalid'), new Date('invalid'))).toBe(false);
  });

  it('returns only changed fields with from/to values', () => {
    const changes = diffFields(
      { name: 'Same', total: 10, startDate: new Date('2020-01-01T00:00:00Z') },
      { name: 'Same', total: 12, startDate: new Date('2020-01-01T00:00:00Z'), endDate: null },
    );

    expect(changes).toEqual({ total: { from: 10, to: 12 } });
    expect(hasChanges(changes)).toBe(true);
    expect(changedValues(changes)).toEqual({ total: 12 });
    expect(changeAuditMetadata(changes)).toEqual({ fields: ['total'], total: { from: 10, to: 12 } });
  });

  it('reports no changes when every field matches', () => {
    const changes = diffFields({ a: 1, b: 'x' }, { a: '1', b: 'x' });

    expect(changes).toEqual({});
    expect(hasChanges(changes)).toBe(false);
  });
});
