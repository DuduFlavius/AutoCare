# AutoCare application workspace — 29 October 2026

Baseline: production commit b57d9309c66f4d3a58edb2d187c5470d786fe613. Implemented on feature/autocare-app-workspace-20261029; baseline preserved as checkpoint/autocare-live-b57d930-20261029. Earlier local work remains on checkpoint/autocare-before-app-shell-20261029.

## Scope and inventory

Existing sections retained: overview, vehicles, documents, calendar, maintenance records, SmartDrive GPS/planner, mileage, expenses, support, vehicle history, notifications, subscription/billing, settings, and role-gated administration/founder tools. Existing record editor, forecasts, GPS engine/history, attachments, exports, billing, push and email flows remain connected to their existing handlers.

The landing page, public content, authentication, database schema, environment variables, Vercel configuration, prices and currency conversion logic are unchanged.

## Changes

- App-only CSS scope and reusable navigation components; grouped desktop sidebar, single mobile dock and drawer.
- Global section/vehicle/record search and existing creation actions, available from the header or Ctrl/Cmd+K.
- Related-page navigation for garage and maintenance workspaces.
- In-memory preservation of section filters and scroll position; history navigation and existing unsaved-record guards retained.
- Validated deep links and server-selected initial section for the account route.
- Dashboard overview uses real account counts and existing cost summary/currency preference.
- Settings separated into account/security, notifications/email, device/display and support. Forms remain mounted while switching settings categories.
- Clear offline status, write protection while disconnected, loading placeholders and an account error recovery screen.
- Keyboard focus, skip link, reduced-motion support and bilingual new interface components.
- Developer-only phone preview (390px container) remains unavailable in production.

## Validation

96 automated tests passed, including permissions, authentication, records, reminders, billing webhooks, support, forecasting and new workspace navigation checks. Three pre-existing expectations were aligned with current live prices, current editorial email header and the existing manual transactional email exception. No production logic was changed to satisfy those expectations.

Build and targeted lint passed. Desktop and 390px browser checks confirmed global search, document filtering, browser-back filter restoration, settings categories and language/currency selection. Existing translation caching was corrected to follow updated React page titles. Legacy styling is isolated through a scoped CSS layer. No real payment was performed and no private account data was used in design previews.
