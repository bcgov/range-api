import path from 'path';
import fs from 'fs';
import os from 'os';
import { Migrator } from 'kysely/migration';
import { db } from '../../src/libs/db2/kysely.js';
import { SqlFileMigrationProvider } from '../../src/libs/db2/migrate.js';

afterAll(async () => {
  await db.destroy();
});

describe('SqlFileMigrationProvider', () => {
  test('returns migration files in sorted order', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    try {
      for (const name of ['b.sql', 'a.sql', 'c.sql']) {
        fs.writeFileSync(path.join(dir, name), '-- migrate:up\nSELECT 1;');
      }

      const provider = new SqlFileMigrationProvider({ migrationFolder: dir });
      const migrations = await provider.getMigrations();

      expect(Object.keys(migrations)).toEqual(['a.sql', 'b.sql', 'c.sql']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns empty record for non-existent directory', async () => {
    const provider = new SqlFileMigrationProvider({
      migrationFolder: '/tmp/nonexistent-migration-dir-12345',
    });
    const migrations = await provider.getMigrations();
    expect(migrations).toEqual({});
  });

  test('treats file with no markers as entire-file-up', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    try {
      fs.writeFileSync(path.join(dir, 'no_markers.sql'), 'CREATE TABLE foo (id integer);');

      const provider = new SqlFileMigrationProvider({ migrationFolder: dir });
      const migrations = await provider.getMigrations();

      expect(Object.keys(migrations)).toEqual(['no_markers.sql']);
      expect(migrations['no_markers.sql']).toBeDefined();
      expect(typeof migrations['no_markers.sql'].up).toBe('function');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('parses up SQL from file with only -- migrate:up (no down marker)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    try {
      fs.writeFileSync(path.join(dir, 'up_only.sql'), '-- migrate:up\nSELECT 1;');

      const provider = new SqlFileMigrationProvider({ migrationFolder: dir });
      const migrations = await provider.getMigrations();

      expect(Object.keys(migrations)).toEqual(['up_only.sql']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('DB Migration System end-to-end', () => {
  let migrationDir;
  const testTable = '_test_migration_e2e';

  beforeAll(async () => {
    await db.schema.dropTable('kysely_migration').ifExists().execute();
    await db.schema.dropTable('kysely_migration_lock').ifExists().execute();

    migrationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    const content = [
      '-- migrate:up',
      `CREATE TABLE ${testTable} (id integer PRIMARY KEY);`,
      '-- migrate:down',
      `DROP TABLE ${testTable};`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(migrationDir, '20260527000000_create_test_table.sql'), content);
  });

  afterAll(async () => {
    await db.schema.dropTable('kysely_migration').ifExists().execute();
    await db.schema.dropTable('kysely_migration_lock').ifExists().execute();
    await db.schema.dropTable(testTable).ifExists().execute();
    if (migrationDir) {
      fs.rmSync(migrationDir, { recursive: true, force: true });
    }
  });

  test('applies a pending migration and records it', async () => {
    const provider = new SqlFileMigrationProvider({
      migrationFolder: migrationDir,
    });
    const migrator = new Migrator({ db, provider });

    const { error, results } = await migrator.migrateToLatest();

    expect(error).toBeUndefined();
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('Success');
    expect(results[0].migrationName).toMatch(/create_test_table\.sql$/);
    expect(results[0].direction).toBe('Up');

    const tables = await db.introspection.getTables();
    const createdTable = tables.find((t) => t.name === testTable);
    expect(createdTable).toBeDefined();

    const trackingRows = await db.selectFrom('kysely_migration').selectAll().execute();
    expect(trackingRows).toHaveLength(1);
    expect(trackingRows[0].name).toMatch(/create_test_table\.sql$/);
  });

  test('is idempotent on second run', async () => {
    const provider = new SqlFileMigrationProvider({
      migrationFolder: migrationDir,
    });
    const migrator = new Migrator({ db, provider });

    const { error, results } = await migrator.migrateToLatest();

    expect(error).toBeUndefined();
    expect(results).toHaveLength(0);
  });
});

describe('Non-transactional migration', () => {
  const testTables = ['_test_concurrent_ok', '_test_concurrent_fail'];

  beforeEach(async () => {
    await db.schema.dropTable('kysely_migration').ifExists().execute();
    await db.schema.dropTable('kysely_migration_lock').ifExists().execute();
  });

  afterAll(async () => {
    for (const t of testTables) {
      await db.schema.dropTable(t).ifExists().execute();
    }
    await db.schema.dropTable('kysely_migration').ifExists().execute();
    await db.schema.dropTable('kysely_migration_lock').ifExists().execute();
  });

  test('CREATE INDEX CONCURRENTLY succeeds with disableTransactions', async () => {
    const tableName = testTables[0];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-ntx-'));
    try {
      fs.writeFileSync(
        path.join(dir, '000_create_table.sql'),
        `-- migrate:up\nCREATE TABLE ${tableName} (id integer NOT NULL);\n-- migrate:down\nDROP TABLE ${tableName};`,
      );
      fs.writeFileSync(
        path.join(dir, '001_create_index.sql'),
        `-- migrate:up\nCREATE INDEX CONCURRENTLY idx_${tableName} ON ${tableName} (id);\n-- migrate:down\nDROP INDEX IF EXISTS idx_${tableName};`,
      );

      const provider = new SqlFileMigrationProvider({ migrationFolder: dir });
      const migrator = new Migrator({ db, provider });

      const { error, results } = await migrator.migrateToLatest({
        disableTransactions: true,
      });

      expect(error).toBeUndefined();
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('Success');
      expect(results[1].status).toBe('Success');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('CREATE INDEX CONCURRENTLY fails without disableTransactions', async () => {
    const tableName = testTables[1];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-ntx-'));
    try {
      fs.writeFileSync(
        path.join(dir, '002_create_table.sql'),
        `-- migrate:up\nCREATE TABLE ${tableName} (id integer NOT NULL);\n-- migrate:down\nDROP TABLE ${tableName};`,
      );
      fs.writeFileSync(
        path.join(dir, '003_create_index.sql'),
        `-- migrate:up\nCREATE INDEX CONCURRENTLY idx_${tableName} ON ${tableName} (id);\n-- migrate:down\nDROP INDEX IF EXISTS idx_${tableName};`,
      );

      const provider = new SqlFileMigrationProvider({ migrationFolder: dir });
      const migrator = new Migrator({ db, provider });

      const { error, results } = await migrator.migrateToLatest();

      expect(error).toBeDefined();
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('Success');
      expect(results[1].status).toBe('Error');

      const tables = await db.introspection.getTables();
      const createdTable = tables.find((t) => t.name === tableName);
      expect(createdTable).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Migration error handling', () => {
  let migrationDir;
  const testTable = '_test_migration_error';

  beforeAll(async () => {
    await db.schema.dropTable('kysely_migration').ifExists().execute();
    await db.schema.dropTable('kysely_migration_lock').ifExists().execute();
  });

  afterAll(async () => {
    await db.schema.dropTable('kysely_migration').ifExists().execute();
    await db.schema.dropTable('kysely_migration_lock').ifExists().execute();
    await db.schema.dropTable(testTable).ifExists().execute();
    if (migrationDir) {
      fs.rmSync(migrationDir, { recursive: true, force: true });
    }
  });

  test('fails cleanly on invalid SQL with no partial changes', async () => {
    migrationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-error-'));
    const validSql = `-- migrate:up\nCREATE TABLE ${testTable} (id integer PRIMARY KEY);\n-- migrate:down\nDROP TABLE ${testTable};`;
    const invalidSql = '-- migrate:up\nCREATE TABLE; -- syntax error';

    fs.writeFileSync(path.join(migrationDir, '001_valid.sql'), validSql);
    fs.writeFileSync(path.join(migrationDir, '002_invalid.sql'), invalidSql);

    const provider = new SqlFileMigrationProvider({
      migrationFolder: migrationDir,
    });
    const migrator = new Migrator({ db, provider });

    const { error, results } = await migrator.migrateToLatest();

    expect(error).toBeDefined();
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('Success');
    expect(results[1].status).toBe('Error');

    const tables = await db.introspection.getTables();
    const createdTable = tables.find((t) => t.name === testTable);
    expect(createdTable).toBeUndefined();

    const trackingRows = await db.selectFrom('kysely_migration').selectAll().execute();
    expect(trackingRows).toHaveLength(0);
  });
});
