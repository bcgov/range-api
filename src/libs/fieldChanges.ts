export type FieldChange = { from: unknown; to: unknown };
export type FieldChanges = Record<string, FieldChange>;

// pg returns timestamptz as Date, numeric as string and arrays as JS arrays, while background
// jobs build values from FTA strings or calculations. Normalize both sides before comparing.
const normalize = (value: unknown): unknown => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) {
    return value
      .map((item) => String(normalize(item)))
      .sort()
      .join('\u0000');
  }
  return value;
};

export const isSameValue = (current: unknown, next: unknown): boolean => {
  const a = normalize(current);
  const b = normalize(next);
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return a === b;
};

export const diffFields = (current: object, next: Record<string, unknown>): FieldChanges => {
  const changes: FieldChanges = {};
  Object.entries(next).forEach(([field, to]) => {
    const from = (current as Record<string, unknown>)[field];
    if (!isSameValue(from, to)) {
      changes[field] = { from: from ?? null, to: to ?? null };
    }
  });
  return changes;
};

export const hasChanges = (changes: FieldChanges): boolean => Object.keys(changes).length > 0;

export const changedValues = (changes: FieldChanges): Record<string, unknown> => {
  const values: Record<string, unknown> = {};
  Object.entries(changes).forEach(([field, { to }]) => {
    values[field] = to;
  });
  return values;
};

export const changeAuditMetadata = (changes: FieldChanges): Record<string, unknown> => ({
  fields: Object.keys(changes),
  ...changes,
});
