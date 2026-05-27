import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import type { Migration, MigrationProvider } from 'kysely/migration';
import pg from 'pg';
import dotenv from 'dotenv';

export interface SqlFileMigrationProviderProps {
  migrationFolder: string;
}

// -- migrate:up marker regex — captures everything between marker and either
// -- migrate:down or end of string.
const UP_MARKER_REGEX = /-- migrate:up\n([\s\S]*?)(?:-- migrate:down|$)/;

export class SqlFileMigrationProvider implements MigrationProvider {
  private migrationFolder: string;

  constructor(props: SqlFileMigrationProviderProps) {
    this.migrationFolder = props.migrationFolder;
  }

  async getMigrations(): Promise<Record<string, Migration>> {
    let files: string[];
    try {
      files = await fs.readdir(this.migrationFolder);
    } catch {
      return {};
    }

    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();
    const migrations: Record<string, Migration> = {};

    for (const file of sqlFiles) {
      const content = await fs.readFile(path.join(this.migrationFolder, file), 'utf-8');

      const upSql = parseUpSql(content);

      migrations[file] = {
        up: async (executeDb) => {
          if (upSql) {
            await sql.raw(upSql).execute(executeDb);
          }
        },
      };
    }

    return migrations;
  }
}

function parseUpSql(content: string): string {
  const upMatch = content.match(UP_MARKER_REGEX);
  if (upMatch) {
    return upMatch[1].trim();
  }

  const hasDownMarker = content.includes('-- migrate:down');
  const hasUpMarker = content.includes('-- migrate:up');

  if (!hasUpMarker && !hasDownMarker) {
    return content.trim();
  }

  return '';
}

const { Pool } = pg;

function createDb(): Kysely<unknown> {
  const dialect = new PostgresDialect({
    pool: new Pool({
      host: process.env.POSTGRESQL_HOST,
      port: parseInt(process.env.POSTGRESQL_PORT || '5432', 10),
      database:
        process.env.NODE_ENV === 'test' && process.env.POSTGRESQL_DATABASE_TEST
          ? process.env.POSTGRESQL_DATABASE_TEST
          : process.env.POSTGRESQL_DATABASE,
      user: process.env.POSTGRESQL_USER,
      password: process.env.POSTGRESQL_PASSWORD,
      max: 10,
    }),
  });
  return new Kysely<unknown>({ dialect });
}

dotenv.config();

async function main(): Promise<void> {
  const disableTransactions = process.argv.includes('--no-transactions');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.join(__dirname, 'migrations');

  const provider = new SqlFileMigrationProvider({
    migrationFolder: migrationsDir,
  });
  const migrator = new Migrator({ db: createDb(), provider });

  const { error, results } = await migrator.migrateToLatest({
    disableTransactions,
  });

  if (results) {
    for (const r of results) {
      const icon = r.status === 'Success' ? '✓' : r.status === 'Error' ? '✗' : '–';
      console.log(`${icon} ${r.migrationName} (${r.direction})`);
    }
  }

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

const thisFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1];
if (entryFile && path.resolve(entryFile) === thisFile) {
  main();
}
