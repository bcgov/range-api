# PRD: range-api Modernization — JavaScript to TypeScript

## Problem Statement

The range-api codebase is built on an aging technology stack: Node.js 6, Babel 7 transpilation via Gulp, Knex 0.21 with a custom ORM-like Model wrapper, and a collection of legacy/unmaintained dependencies (`request`, `@bcgov/nodejs-common-utils`, `nconf`, `moment`, `lodash`, etc.). There are no static types, making the codebase difficult to refactor safely and hard for new developers to navigate. The PostgreSQL server and CI toolchain are also outdated. The frontend (range-web) will be addressed in a separate phase.

## Solution

Convert range-api from JavaScript to TypeScript, upgrade to Node.js 24 (Active LTS) and PostgreSQL 16, modernize the dependency tree, and replace the database access layer with Kysely for compile-time query safety. The conversion will be incremental — JavaScript and TypeScript files coexist during the transition — with no behavioral changes to the running API.

## User Stories

1. As a developer, I want the API to run on Node.js 24, so that we receive security patches and can use modern language features without transpilation.
2. As a developer, I want the codebase to use TypeScript with `noImplicitAny`, so that I catch type errors at compile time rather than runtime.
3. As a developer, I want JavaScript and TypeScript files to coexist during migration, so that I can convert modules incrementally without blocking releases.
4. As a developer, I want the build pipeline to use `tsc` instead of Gulp + Babel, so that build configuration is simpler and faster.
5. As a developer, I want the dev server to use `tsx watch` instead of `nodemon + babel-node`, so that hot-reload works natively with TypeScript.
6. As a developer, I want the test framework to be vitest instead of Jest, so that tests run faster with native TypeScript and ESM support.
7. As a developer, I want the linting stack to use ESLint 9 with `typescript-eslint`, so that TypeScript-aware lint rules are enforced.
8. As a developer, I want the lint-staged pre-commit hook to run on both `.js` and `.ts` files, so that formatting is enforced consistently during migration.
9. As a developer, I want the Docker build to use a multi-stage pipeline with `tsc`, so that production images are smaller and exclude dev dependencies.
10. As a developer, I want the config module replaced with a typed plain object, so that configuration access is type-safe and has zero external dependencies.
11. As a developer, I want `@bcgov/nodejs-common-utils` replaced with a local shim backed by `pino` for logging and a local `errorWithCode` utility, so that we remove the dependency on an unmaintained internal package.
12. As a developer, I want `nconf` replaced with a typed config object, so that configuration loading has no external dependencies and full type safety.
13. As a developer, I want `moment` replaced with `dayjs`, so that the bundle is smaller (2KB vs ~300KB) while keeping the same API.
14. As a developer, I want `request` and `request-promise-native` replaced with native `fetch`, so that we remove a deprecated library with known vulnerabilities.
15. As a developer, I want `lodash` removed and its usages replaced with native JavaScript equivalents (`Array.flat()` etc.), so that the dependency tree is lighter.
16. As a developer, I want Knex 0.21 and the custom Model base class replaced with Kysely, so that database queries are type-checked at compile time against a schema definition.
17. As an operator, I want the API to use PostgreSQL 16, so that we are on a supported database version with modern features.
18. As a developer, I want Express upgraded from v4 to v5, so that async error handling is native and `body-parser` / `cookie-parser` are no longer needed.
19. As a developer, I want `passport`, `passport-jwt`, and `jwks-rsa` upgraded to their latest versions, so that the auth stack receives security patches.
20. As a developer, I want the scripts directory (`scripts/`) migrated to TypeScript alongside the source code, so that all executable code benefits from type checking.
21. As a developer, I want dead dependencies removed (`deepdash`, `js-yaml`, `ip`, `handlebars`, `chalk`, `connect-flash`, `faker`, `wkhtmltopdf`, `passport-oauth2`), so that the dependency tree is clean and auditable.
22. As a developer, I want all Babel-related packages removed (`@babel/*`, `babel-jest`, `babel-eslint-parser`), so that tooling is TypeScript-native.
23. As a developer, I want all Gulp-related packages removed (`gulp`, `gulp-babel`, `gulp-clean`, `gulp-sourcemaps`), so that the build pipeline uses `tsc` only.
24. As a developer, I want the config, bcgov-shim, and Kysely model modules tested in isolation, so that core infrastructure is verified independently.
25. As a developer, I want the existing API integration tests migrated from Jest to vitest with no loss of coverage, so that the test suite remains reliable.

## Implementation Decisions

### Build & Toolchain

- TypeScript compiler (`tsc`) replaces Gulp + Babel for all transpilation
- `tsx` replaces `nodemon` + `babel-node` for development hot-reload
- vitest replaces Jest with `supertest` retained for HTTP integration tests
- ESLint 9 with flat config and `typescript-eslint` (unified parser + plugin package)
- husky v9 + lint-staged retained, patterns updated to include `.ts`
- Multi-stage Dockerfile: build stage with full dev deps, runtime stage with production deps only

### TypeScript Configuration

- Incremental migration via `allowJs: true`
- `noImplicitAny: true` without full `strict` (strictNullChecks etc. enabled in subsequent phases)
- Target ES2022, module NodeNext for native ESM output
- `rootDir: "."` to preserve `build/src/` and `build/scripts/` directory structure

### Module System

- ESM throughout (`"type": "module"` in package.json)
- Express 5 handles async errors natively — `asyncMiddleware` wrappers removed

### Config Module

- Plain typed config object replacing `nconf`
- Validates required env vars (`SSO_URL`, `POSTGRESQL_*`, `MINIO_*`) at import time
- Config access changes from `config.get('sso:certsUrl')` to `config.sso.certsUrl`

### bcgov-shim Module

- New deep module: `src/libs/bcgov-shim.ts`
- Three exports: `logger` (pino instance), `errorWithCode(message, code)` (returns Error with numeric code), `started(port)` (logs startup)
- All `@bcgov/nodejs-common-utils` imports replaced with this shim (no behavioral change)
- Mock file `__mocks__/@bcgov/nodejs-common-utils.js` deleted

### Database Layer

- Kysely replaces Knex 0.21 and the entire `Model` base class hierarchy
- Schema types defined per table using Kysely's codegen or manual type definitions
- Each model (plan, agreement, user, pasture, etc.) becomes a standalone query module with typed CRUD operations
- Knex retained as a standalone migration runner only (no runtime queries)
- Existing migration scripts are NOT run — database state is preserved as-is

### Scripts

- `scripts/` directory migrated to TypeScript alongside `src/`
- Dead scripts removed: `old_import.js`, `mockData.js`, `harness.js`

### Docker

- Multi-stage build: stage 1 (`tsc` compilation), stage 2 (runtime with only `build/` + production deps)
- Build scripts in `package.json` updated: `npm run build` → `tsc`

### Migration Order (5 Phases)

- **Phase 1: Foundation** — TypeScript init, vitest config, ESLint config, remove dead deps, remove Babel/Gulp
- **Phase 2: Replacements with shims** — bcgov-shim, config rewrite, lodash removal, moment→dayjs, request→fetch
- **Phase 3: Framework upgrades** — Express 5, passport stack, Docker multi-stage
- **Phase 4: Database layer** — Kysely schema types, one table at a time
- **Phase 5: Incremental TypeScript conversion** — rename files from leaf modules up

## Testing Decisions

### Testing Philosophy

- Tests should verify external behavior (HTTP status codes, response shapes, database insertions/updates), not implementation details (which query builder is used, which logger is called)
- Unit tests for pure functions (helpers, utilities) without database or network
- Integration tests for HTTP endpoints using supertest (same pattern as current `__tests__/api_v1/`)
- Each module conversion is verified by running the existing test suite against it before moving to the next module

### Modules Tested

- **Config** — test that env vars are loaded correctly, defaults applied, missing required vars throw
- **bcgov-shim** — test logger output format, errorWithCode returns Error with correct code, started logs port
- **Helpers** (PDF, notification, livestock calculation, etc.) — pure function unit tests
- **Kysely model modules** — query builders tested against test DB (same pattern as existing Model class tests)
- **Route handlers** — integration tests via supertest (prior art: `__tests__/api_v1/*.spec.js`)
- **Auth middleware** — test token validation, role extraction, user creation (prior art: `auth.spec.js`)

### Test Configuration

- vitest config replaces Jest config in package.json
- `__testHelpers__/` retained for shared utilities (test token, header setup)
- `__mocks__/` cleaned up (remove @bcgov mock, keep passport mock and fixtures)
- `setup.js` adapted for vitest globals

## Out of Scope

- Frontend (range-web) migration — separate phase
- PostgreSQL migration scripts — database state is preserved, only driver/pool config changes
- Minio client upgrade (v7→v8) — deferred to separate pass
- CSV library upgrade (v3→v6) — deferred to separate pass
- CDOGS PDF generation changes — only dependency updates, no behavior changes
- Schema changes or data migrations — no new tables or columns
- API contract changes — all endpoints, request/response shapes remain identical
- Performance optimization or architectural refactoring beyond TypeScript conversion
- Removal of the deprecated `wkhtmltopdf` binary directory from the repo

## Further Notes

- The `src/types/` directory (currently empty) will hold shared TypeScript type definitions, Kysely schema type declarations, and Express request extensions
- `cross-env` retained in devDependencies — used for cross-platform environment variable setting in CI
- husky v9 no longer requires `"prepare": "husky install"` — the `prepare` script can be removed; husky configures itself on `npm install` automatically in v9+
- This PRD supersedes any previous informal migration plans; all decisions were resolved in a structured interview process documented in the conversation
