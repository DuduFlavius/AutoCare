# AutoCare SmartDrive — isolated validation runbook

Status: **instructions only**. Do not run against production, copied production data, or the existing `autocare-migration-check-20261020` branch.

## Isolation and cost gate

1. In Neon Console, check plan limits/pricing **before** creating a resource. If a new project would cost money, stop and request approval.
2. Create a **new empty Neon project**, e.g. `autocare-smartdrive-isolated`, not a branch cloned from `neon-almond-drawer`. Create a new database with no application records. Confirm the project ID is different from `neon-almond-drawer` and no tables have been imported.
3. Use a dedicated database role for testing. Keep its connection string in local secrets or Vercel Preview scoped to `feature/autocare-premium-rebuild`. Never print or commit the URL. Keep Production variables unchanged.
4. Create two fictitious users via the existing application authentication test flow only. Do not copy users, vehicles, sessions or files from other databases.

## Migration order on an empty database

The existing `scripts/migrate.ts` reads `migrations/*.sql` alphabetically and runs every missing file in a transaction. The required order is:

1. `0000_previous_santa_claus.sql`
2. `0001_integrity.sql`
3. `0001_secret_changeling.sql`
4. `0002_white_millenium_guard.sql`
5. `0003_notification_read.sql`
6. `0003_photo_integrity.sql`
7. `0004_support_chat.sql`
8. `0005_0_support_threads.sql`
9. `0005_founder_premium.sql`
10. `0006_chat_workflow.sql`
11. `0007_support_history.sql`
12. `0008_legacy_premium.sql`
13. `0009_smartdrive_history.sql`

Do not execute just 0009 on an empty database: it requires `app_user`, `vehicles` and the `vehicle_owner_pair` unique constraint established by previous migrations. `0001_integrity.sql` creates that unique constraint. The new composite FKs in 0009 reference it.

Before authorizing execution, inspect all migration SQL against a freshly created empty test database; verify no unexpected preconditions. Running `npm run db:migrate` **will execute all missing files** against `DATABASE_URL` and create `autocare_migrations`. The command is NOT a dry run. Never run it until the environment has been independently verified as isolated.

## Test commands (from package.json)

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The core test suite uses `LOCAL_DATABASE_PATH=memory` (PGlite) and invokes the full migration runner. Before running tests, ensure the shell has **no `DATABASE_URL`** set: `src/lib/db.ts` prioritizes `DATABASE_URL` over `LOCAL_DATABASE_PATH`, which would otherwise make the tests touch a real database. Run tests only in an isolated shell/container with no production environment variables.

The suite includes API tests for confirmed mileage, repeated readings, regression/negative validation, owner isolation, cross-owner FK rejection at DB level, GPS trip duration/distance and speed, session expiry, reminder preferences, and GPS/odometer separation. Unit tests cover mileage averages and insufficient data. Tests must be **executed** and failures investigated before claiming success.

## Post-migration metadata checks

Verify the three new tables and their columns, the two named composite foreign keys `mileage_reading_owner_vehicle_fk` and `gps_trip_owner_vehicle_fk`, both history indexes, and the `0009_smartdrive_history.sql` migration history entry. Use metadata-only queries initially.

For API integration tests on the isolated project, confirm two fictitious users have separate vehicles; insert only fictional readings and trips, reload, and verify ownership isolation. GPS trips must never update `vehicles.odometer`.

## Preview

Only after explicit authorization, set Preview-only, Git-branch-scoped `DATABASE_URL` to the isolated project; use separate Preview auth settings and a fixed Preview URL. Verify Production variables were not changed. Never run the migration against the previously cloned test branch or Production.
