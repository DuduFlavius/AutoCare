# AutoCare Mail Center Premium

## Scope and release

Work stays on `feature/autocare-premium-rebuild`. The production target is the existing
`autocare.vercel` project (`prj_zsagj49xRF0qbIICeSaBRnoAo1NW`, Roomlyy), serving
`https://project-sxage.vercel.app`. No new paid service or dependency was added to the app.

The shared renderer provides ten distinct templates: Gmail test, welcome, email verification,
password reset, Premium expiry, renewal, failed payment, administrative, promotional and
vehicle reminder. It reuses the project's existing cinematic `public/design-car.jpg` photo.
Templates have a 600px table layout, inline styling, a mobile media query, personalized greeting,
preheader, live application CTA, fallback URL, plain-text alternative and preference/privacy links.
No contact phone, postal address or fictional support email is introduced.

Existing Resend sends remain on Resend with their original idempotency keys. Verification and
reset preserve the exact Better Auth action URL in HTML and plain text. Support and reminder
emails also get the branded HTML layout. Gmail sends use RFC 2047 subjects and
multipart/alternative MIME. The official Gmail test still goes only to GOOGLE_MAIL_FROM.

## Founder workflow

Open **Panou Fondator → Mail Center**. Select a template, choose transactional or promotional,
compose plain text, choose up to 50 existing accounts, and preview on desktop/mobile. Only
application-relative CTA paths are accepted. User input is HTML-escaped; raw HTML/scripts
cannot be authored. The preview is a sandboxed iframe with no script permission.

Security templates can be previewed, but verification/reset must be sent through their original
secure authentication flows; Mail Center never manufactures or stores their action tokens.
Gmail test uses the dedicated existing Gmail connection controls. All other selected recipients
receive individual, personalized messages, never a shared To/CC list.

Save a reviewed draft, confirm content/category/recipients, then send a manual batch of at most
two recipients. Continue manually for the next batch. A saved draft is immutable; use a new draft
for changed content. Reopening history restores its actual recipient list. The Gmail connection
must have passed its manual test before manual campaign sending.

## Consent, delivery states and duplicate protection

The separate Communication Preferences section in account Settings allows opt-out from
subscription/administrative messages and explicit opt-in/out for promotional mail. Promotional
consent defaults false. The existing global Email preference, verified address and account
suspension are rechecked immediately before each send. Security messages explicitly requested
by the account owner continue independently. Users can withdraw promotional consent through
the authenticated preferences link in every promotional email. JSON personal-data export includes
communication preferences and the account's own email history.

Draft IDs are client-generated UUIDs reused on retries. Canonical content fingerprints reject ID
reuse with changed content; per-recipient dedupe keys and atomic pending→sending claims prevent
concurrent duplicate sends. Gmail does not provide an idempotent send API: a timeout/ambiguous
outcome is marked UNKNOWN and is never automatically retried. An interrupted worker is also
marked UNKNOWN after two minutes. Check Gmail manually before any new intentional send.
Message-ID is stable for the delivery, but is not treated as a delivery guarantee.

Accepted means provider acceptance, not inbox delivery. Gmail has no delivery webhook in this
integration, so it never claims DELIVERED from a successful send response. Existing verified
Resend webhooks can upgrade their corresponding system history records. Errors contain only
bounded internal/provider status codes, never response bodies, credentials or OAuth tokens.
Auth history contains template metadata and hashed identifiers, not authentication URLs or tokens.
History records and preferences cascade on account deletion; campaign actor becomes null.
Backups include the new tables while still excluding private Gmail authorization settings.

## Automations remain OFF

Stripe invoice.paid with billing_reason=subscription_cycle queues renewal; initial checkout is
not mislabeled renewal. invoice.payment_failed queues one record per invoice attempt only if
current fetched subscription state still requires payment. Queuing occurs in the same database
transaction as the verified webhook processing and is deduplicated. Registration queues welcome.
The existing reminder job schedules expiry within seven days only for finite, nonrenewing access.
Active auto-renewing subscriptions, lifetime access and longer manual grants suppress expiry.
At dispatch, current subscription period, payment state, grants and communication preferences are
checked again. Old recovered failure events/renewed periods are suppressed. Welcome older than
24h is suppressed rather than replayed after a long testing hold.

No new automatic mail is sent unless BOTH gates pass:

1. Founder explicitly attests all templates were tested and real inbox delivery was verified,
   after the existing Gmail connection test. Approval is stored in audit/settings.
2. A separate authorized deployment configures `AUTOCARE_MAIL_AUTOMATIONS_ENABLED=true`.

This release does not configure that variable and does not record approval. Existing vehicle
reminder/support/auth behavior is retained; new welcome/subscription/payment automations are held.
The approval action itself does not activate sending while the deployment gate is off.

## Database migration and validation

`migrations/0010_mail_center.sql` adds only communication_preferences, mail_campaigns,
mail_deliveries and indexes. It does not alter existing application tables or user data.
The migration is managed in code and exercised by the existing isolated PGlite migration/tests.
The Vercel build command runs `npm run build && npm run db:mail-center`: only after a passing
build, the dedicated script applies this one additive migration transactionally in that deployment's
configured database, then records it in autocare_migrations. It uses a direct Neon host when the
configured URL is pooled. Database errors are logged without connection details. A failing
migration fails the deployment, retaining the previous production deployment.

Run lint, TypeScript, the full test suite and build before deployment. Browser QA uses only
isolated local accounts/data; provider tests mock Gmail/Stripe/Resend and never send real emails.
Real Gmail inbox placement and Gmail/mobile-client rendering still require the Founder's actual
consent/test mailbox before automation approval. Browser layout verification is not a substitute
for Gmail inbox verification.
