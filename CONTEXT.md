# Range API — Domain Glossary

## Migration System

| Term                | Definition                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration file      | A timestamp-prefixed `.sql` file (e.g., `20260527000000_create_foo.sql`) containing up/down DDL delimited by `-- migrate:up` / `-- migrate:down` markers                                                    |
| Migration directory | `src/libs/db2/migrations/` — where migration files live                                                                                                                                                     |
| Tracking tables     | `kysely_migration` (name, timestamp) and `kysely_migration_lock` (id, is_locked) — created and managed by Kysely's Migrator                                                                                 |
| Baseline            | No baseline record. Drop old Knex tables, let Kysely create empty tracking tables. First real migration is the first one tracked.                                                                           |
| Invocation          | CLI via npm script (`npm run db:migrate`), manually triggered                                                                                                                                               |
| Rollback            | Not exposed as a command; down SQL stored in files for reference only                                                                                                                                       |
| Transactionality    | Batch-level via Kysely's Migrator (all migrations in one transaction by default). Per-migration opt-out via `npm run db:migrate -- --no-transactions` for the rare case (e.g., `CREATE INDEX CONCURRENTLY`) |
| Migration runner    | Kysely's `Migrator` + custom `SqlFileMigrationProvider` (`src/libs/db2/migrate.ts`) — reads `.sql` files, parses markers, delegates orchestration to Kysely                                                 |
| CLI command         | `npm run db:migrate` — applies all pending migrations                                                                                                                                                       |
| Baseline procedure  | One-time `npm run db:migrate:baseline` — drops old Knex tables, creates Kysely migration tables, inserts baseline record to mark current schema state                                                       |
| Error handling      | Handled by Kysely Migrator (never throws, returns `{error, results}`, fail-stop, no partial recording)                                                                                                      |
| Auxiliary commands  | None initially — only `db:migrate` and `db:migrate:baseline`                                                                                                                                                |
| File format         | `-- migrate:up` / `-- migrate:down` section delimiter comments; `-- migrate:no-transaction` not needed at file level (controlled by CLI flag)                                                               |
| PRD                 | [Issue #473](https://github.com/bcgov/range-api/issues/473) — DB Migration System                                                                                                                           |
