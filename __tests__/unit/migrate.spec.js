import { afterEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/libs/db2/migrate.ts';

const originalNodeEnv = process.env.NODE_ENV;
const originalTestDatabase = process.env.POSTGRESQL_DATABASE_TEST;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.POSTGRESQL_DATABASE_TEST = originalTestDatabase;
});

describe('createDb', () => {
  it.each(['test', 'unit_test'])('rejects %s when the test database is not configured', (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
    delete process.env.POSTGRESQL_DATABASE_TEST;

    expect(() => createDb()).toThrow('POSTGRESQL_DATABASE_TEST must be set');
  });
});
