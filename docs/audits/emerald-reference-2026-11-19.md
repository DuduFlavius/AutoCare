# Emerald reference implementation — 19 November 2026

Base: ac7a1357420cb94888afa92c3f19984ffa30758b. The user approved the new emerald/teal references, replacing the earlier navy/purple direction. No vehicle photograph or invented telemetry was added.

## Changes
- Central important cascade layer gives the workspace a dark green/black palette, emerald borders, teal buttons and restrained decorative curves. Existing logo assets remain.
- Mobile Home: actual selected vehicle, recorded mileage and ITP expiry, next maintenance, four shortcuts, actual costs/documents and recent expenses. Vehicle picker remains interactive.
- Mobile navigation: Home, Documents, Reports, Calendar, Settings. Existing other routes remain accessible through Home, settings and desktop navigation.
- Document categories are accessible filter pills. Search and categories span mobile width. Existing upload, details, actions, exports and archive filtering remain.
- Reports include a summary and the existing real-data timeline, preserving gaps for missing periods. Export filters, PDF and CSV are unchanged.
- Calendar mobile rows allow title, vehicle and status to wrap without squeezing into three narrow columns.
- AI layout contracts from the base commit remain; only theme styling changed. PWA theme and generated splash palette match.

## Validation
- ESLint passed; TypeScript passed; production Next.js build passed.
- 334 automated tests passed, including a new report test for duplicate IDs, unknown amounts, future/archived entries and actual service counts.
- Browser QA used the actual Dashboard component with the repository's isolated preview fixtures; no production records or external API calls were created.
- Visually inspected Home, Documents, Reports, Calendar, Settings and AI at mobile size; tested bottom navigation, document ITP filtering, report period controls and RO/EN switching.
- Inspected desktop at 1366×768 and 1920×1080 and Documents at 320×740. Corrected mileage wrapping, small-screen header collision and legacy document filter widths.
- AI provider calls are disabled in the isolated preview, so response generation was not tested by this redesign QA.
- No physical Android/iPhone testing, native release build, Gmail/Stripe end-to-end test or general SEO audit is claimed by this change. Authentication/founder theme rules were added but their authenticated flows were not visually exercised in this QA.
- No database migration, data deletion, pricing change or permissions change.

Backup: backup/pre-emerald-2026-11-19 points to the base commit. Production deployment is verified separately against /api/app-version.
