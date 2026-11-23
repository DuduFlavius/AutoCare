# SmartDrive 5 — permanent session controls

Status: implemented; visual/device acceptance pending. Included in the combined web release explicitly authorized on 23 November; see `ai-support-release-20261123.md`.

Branch: `feature/smartdrive-visible-session-20261123`.
Base source matches the previously published reference-chat release.

## Interface

- Dedicated Petrol speed card in the bottom-left of the map, with 44–52 px mobile digits and a visible km/h label. Missing speed is a dash.
- The session panel is a separate grid row below the map, rather than an overlay. Speed, recorded distance, HH:MM:SS, average speed, maximum speed and GPS status remain visible.
- Start / Pause / Continue / Finish have text, 22–23 px icons and touch areas of at least 44 px. Finish uses the existing accessible confirmation queue.
- Persistent statistics and recording controls are outside the former expandable journey panel. Old duplicate session controls were removed from advanced settings.
- The destination input is directly visible above the map. Map controls have opaque surfaces and separate right-side positions.
- Safe-area padding applies to the lower panel. Compact mobile metrics use three columns; desktop uses six columns where space permits.

## Session behavior

- Timestamp-based active duration starts on Start and advances independently of GPS delivery and map animation.
- Browser pause stops its recording watcher and distance anchors and freezes active time. Resume starts a fresh anchor; a segment spanning the pause is not counted.
- Android pause is durable native state. It leaves the foreground service notification present, discards incoming recording points, and excludes paused time from session duration. Resume inserts a route break.
- Android now preserves valid measured speed and heading in native JSON. These fields were previously omitted by both native serialization and the TypeScript snapshot schema, which prevented speed from reaching the UI.
- Current speed uses valid GPS speed, or a bounded distance/time estimate from sufficiently accurate fresh coordinates. Weak, stale and impossible data remain unknown.
- Average uses recorded distance and active duration. Maximum uses validated observations and survives native snapshots / browser draft recovery.
- Finalization sends active duration plus paused-time validation metadata to the existing trip endpoint. No schema migration is needed. Existing trip IDs, vehicle locks, odometer carry, ownership checks and deduplication remain in place.
- Browser destination search and routing use authenticated, rate-limited server routes and validated real provider data. Android retains its existing native provider. Browser background tracking is not promised.
- Android source version: 1.7.2 (23). No signed installable update was produced or published.

## Verification

- 365 automated tests passed, including active-time pause/resume/finalize, GPS speed validation, native telemetry preservation, authenticated routing and a database test proving paused duration saves correctly and mileage is synchronized once on retries.
- ESLint and TypeScript passed.
- The final web production build passed, including TypeScript and route generation.
- The local isolated visual fixture builds successfully with esbuild using actual application components and CSS. It contains only synthetic telemetry and disables account/GPS submissions.
- Run `node scripts/audit/smartdrive-visual-preview.mjs` from the repository root to generate its files under `/workspace/shared/autocare-smartdrive-qa/`.
- Android Gradle verification could not start: the wrapper distribution was unavailable locally and its download failed with `Network is unreachable`. No Android build/test success is claimed.

## Mandatory visual matrix — not yet executed

| State | 320 px | 375 px | 390 px | 430 px | Desktop |
| --- | --- | --- | --- | --- | --- |
| Idle | Pending | Pending | Pending | Pending | Pending |
| Active | Pending | Pending | Pending | Pending | Pending |
| Paused | Pending | Pending | Pending | Pending | Pending |
| Finished | Pending | Pending | Pending | Pending | Pending |
| GPS unavailable | Pending | Pending | Pending | Pending | Pending |
| Weak GPS | Pending | Pending | Pending | Pending | Pending |
| Navigation active | Pending | Pending | Pending | Pending | Pending |

The browser could not access the local test server; direct file navigation was rejected by browser URL policy. No workaround for that denial was attempted. The user explicitly declined a temporary shareable Vercel Preview link and asked to retain protected access. No new share link or project-access change was made. The later combined production release was explicitly authorized by the owner; no visual/device acceptance is implied by that publication.

A rendered, authenticated visual review and a physical Android check remain required before treating this redesign as accepted. No screenshots or on-road results have been fabricated. The owner subsequently requested the grouped web deployment despite the remaining visual/device checks. The release report records those limits.
