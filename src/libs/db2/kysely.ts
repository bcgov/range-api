import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import config from '../../config/index.js';
import type { DB } from './schema.js';

const { Pool } = pg;

const dialect = new PostgresDialect({
  pool: new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    max: 10,
  }),
});

export const db = new Kysely<DB>({
  dialect,
});

export type Database = DB;
