# Reference-led mobile screens — 13 November 2026

## Implemented
The supplied eight-screen mobile reference now drives actual mobile components, rather than squeezing the desktop Home dashboard. No BMW photograph, phone frame, fake status bar, sample vehicle, fake social sign-in button or simulated live value was introduced into production.

- Mobile Home: compact personalized greeting, real vehicle selector and symbolic vehicle card, next recorded maintenance deadline, four compact indicators, Premium-gated AI entry, three recent recorded expenses. Desktop Home remains unchanged.
- Four destinations follow the latest reference: Home, Documents, History, Settings. Garage remains accessible from the Home vehicle card and Settings. All existing secondary modules remain in Settings' expandable tools and existing navigation/search.
- Digital document vault is an actual reusable component on mobile and desktop: scoped car selector, three main statistics, expired/incomplete information, search/category/status/archive filters, real issue/expiry dates and days, type icons, file preview/download, editing, uploading, file deletion confirmation, revision history, archival and restoration. Scoped Premium CSV/PDF exports retain their server checks. Missing expiry data is never marked valid.
- Mobile finance: recorded-cost summary, sparse chart, six/twelve/twenty-four-month/all-history choices, compact transactions, existing contextual actions and exports. Advanced budgets/category/AI panels can be expanded, not deleted. The initial current-year selection stays aligned with the ledger; selecting 1Y switches to a rolling twelve-month window. Missing months are gaps, not fabricated curve values. Long all-history timelines aggregate by year without dropping amounts.
- Mobile account/settings: real profile, garage, notifications, immediate RO/EN choice, device/help/logout; secondary tools remain accessible.
- Notifications: real unread count and an entry button that scrolls to actual alerts. Delivery configuration remains accessible in a disclosure panel; permissions are not silently granted.
- Authentication: phone layout uses a full-height navy surface with subtle vector waves, centered AutoCare branding, compact real email/password forms and genuine recovery/registration links. No unconfigured Google/Apple/phone login controls were added.
- Native launch sources: removed the default white Capacitor splash from active Android/iOS launch configuration. Both use the existing AutoCare gauge brand and navy background. Android uses vector drawables; iOS uses a vector image set and an AutoCare/Premium launch storyboard. App IDs, tracking permissions and signing configuration are unchanged. These source changes require a native rebuild; a web deploy cannot replace an installed binary's launch screen.

## Verification and limits
272 automated tests pass, including shared finance reconciliation and sparse timeline tests plus server-rendered Home/Vault checks for actual fixture data, unknown expiry, export parameters and absence of stock BMW imagery. TypeScript, lint and production build are required before deployment. Native resource XML was parsed successfully. No production records were inserted, modified or deleted for QA.

Browser cannot connect to this environment's local development server. Live public authentication review is distinct from authenticated private-page and real-device verification. No claim of pixel-perfect certification or signed Android/iOS release is made. Do not label a responsive web check as native background GPS/device testing.
