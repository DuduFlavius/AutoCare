# Finance, document vault and mobile refinement — 13 November 2026

## Scope
Desktop Home dashboard component and data are unchanged. Existing account palette, icon identity, vehicle records, authentication and subscription prices are preserved. No BMW stock photograph or mock financial history was added. Existing Capacitor Android/iOS hosted shells receive this web interface through their configured production URL.

## Finance
- Responsive SVG current/previous period chart replaces cramped bar buttons. Horizontal month/day labels, pointer/touch selection, keyboard focus and Enter/Space support expose actual recorded values.
- Monthly/annual chart choice updates the ledger period. Ledger filters remain independent when deliberately changed; their four metrics describe the filtered, active, dated, known-cost selection. Archived, unknown, future and planned entries do not inflate these totals.
- Source records deduplicate by immutable record ID. Category, chart and headline totals reconcile for the same year/vehicle. Separate records with different IDs are not guessed to be duplicates or deleted.
- Ledger has category badges, four selection metrics, category/date/value sorting, existing scoped CSV/PDF exports, attachment preview/download, and three-dot edit/archive/restore actions. Mobile rows become cards.
- Restore is authenticated, owner-scoped, idempotent, transactional and audited, and refuses archived vehicles. It never re-sends historical notifications. Existing scheduler can evaluate restored active records through its existing deduplication rules.
- Financial analysis uses recorded costs and maintenance. A monthly mean estimate is available only with at least three completed months containing recorded costs, using up to six such months. Missing months are not treated as zero; this is a sparse-history estimate, not a guaranteed future cost. Outlier review needs at least five positive recorded costs and a value at least three times the annual median. It is not a fraud verdict.
- Existing saved per-vehicle budget and threshold alerts remain; no invented budgets.

## Documents and access
- Vehicle folder selector and existing owner-scoped filters select each car's real files; document statistics, issue/expiry dates, statuses, days remaining, uploads, editing, history and archival are preserved. Document type icons, navy cards and direct download improve scanning.
- Sign-in, registration, password recovery and reset share the refined authentication surface; authentication handlers/validation/session rules are unchanged.
- Four mobile dock destinations: Home, My Garage, Documents, History (finance). Account/settings and notifications remain in the top controls; secondary modules stay available from account/search and existing links. Native Back/session/GPS logic is unchanged.

## Verification
269 automated tests pass, including auth/signup/reset/session, file ownership/export behavior, finance period reconciliation, duplicate ID handling, conservative forecasts, outliers, archive/restore ownership/idempotency/audit, and four-destination navigation. TypeScript, ESLint and production build pass. Actual browser/device checks are reported separately; automated coverage is not real Android/iPhone certification.

## Distribution limits
Existing native projects, app ID, icons, splash, foreground/background GPS and permission definitions are retained. This change produces no signed Android AAB or iOS archive. Store launch still needs the owner's release signing, native build and real-device testing, push/payment policy review and final privacy/store disclosures, as documented in google-play/READINESS-2026-11-12.md. A responsive web update is not store approval.
