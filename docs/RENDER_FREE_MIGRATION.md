# AutoCare — Render Free migration

## Prepared, not deployed

The repository now includes a `render.yaml` Blueprint for exactly one Node web service on `plan: free`. It creates no databases, paid cron services or disks. Automatic deployment is disabled to keep releases reviewable. Render account connection, repository access and private environment configuration are required before deployment can be completed. No database or live Stripe configuration was modified while preparing this migration.

## Initial URL and later domain

Render assigns the actual `https://<available-name>.onrender.com` URL when creating the service; do not assume that the short name `autocare` is available. `RENDER_EXTERNAL_URL` is used automatically when `APP_URL` is absent. Canonical links, authentication callbacks and Checkout return URLs use that origin. Build metadata includes `RENDER_GIT_COMMIT`.

When a custom domain is purchased:

1. Add the domain in Render and set the DNS records Render actually supplies.
2. Wait for domain validation and HTTPS.
3. Set `APP_URL` to the new HTTPS origin, rebuild and deploy. This explicit value overrides the free Render URL.
4. Update Stripe webhook destinations, Resend webhook destinations, any OAuth callback allowlists, push/Android app links, scheduler URL and Google Search Console/sitemap.
5. Publish a mobile application update using the new canonical `server.url`. Existing installed builds still point at Vercel until updated; deploying the website alone does not rewrite installed apps.

The existing `*.vercel.app` hostname cannot be transferred to Render. Sessions are scoped to a hostname: users may need to sign in again; accounts, passwords and records remain in the same database.

## Private configuration

Supply the existing production values privately in Render, never commit them or paste them into chat. Do not copy Vercel system variables such as VERCEL_ENV into Render.

Required:

- `DATABASE_URL`: the **same existing external PostgreSQL database**. Take and verify a backup before the first startup. Do not create a replacement Render Free PostgreSQL database; it has separate limits and is not a migration of existing data.
- `BETTER_AUTH_SECRET`: reuse the existing secret, not a generated replacement.
- `CRON_SECRET`: reuse the protected reminder endpoint secret, also configured privately in the scheduler.

Preserve all currently configured feature/security settings, including `AUTOCARE_REQUIRE_EMAIL_VERIFICATION` and provider model/limits. The Blueprint only prompts for the three required secrets. Add the existing optional integrations separately before accepting the new site as fully functional:

- Email: `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` and existing optional mail settings. Keep the verified sender domain unchanged unless the sender is intentionally migrated.
- AI: `GEMINI_API_KEY`, `GEMINI_MODEL` (or the existing OpenAI provider configuration), and existing model/rate limit settings. Do not replace an active provider with invented credentials.
- Payments: `STRIPE_SECRET_KEY`, `AUTOCARE_ENABLE_LIVE_PAYMENTS`, the three existing RON Price IDs, the verified existing EUR Price IDs and `AUTOCARE_ENABLE_EUR_PAYMENTS` only after Test Mode validation. No existing subscription, currency or amount is automatically changed.
- Set `STRIPE_WEBHOOK_SECRET` to the signing secret for the actual new webhook destination `/api/v1/billing/webhook`. Creating a separate destination produces a different signing secret. Preserve the same Stripe account/products and validate signed events before payment release.
- Push: existing `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and any matching public key setting.
- Preserve any other application-specific secrets and feature flags from the existing service, using a reviewed environment-variable inventory rather than logging values.

## Build/start behavior

- Build: `npm ci --include=dev && npm run build`.
- Start: `npm run start:render`.
- Node: 24.22.1, the documented current Render default verified on 12 November 2026.
- Start fails before migrations if external PostgreSQL, existing auth secret, HTTPS origin or port configuration is invalid.
- Startup applies the same existing additive migration script required by the Vercel deployment, then starts Next.js on `0.0.0.0:$PORT`. There is no fresh database bootstrap or destructive migration.
- Health endpoint: `/api/app-version` checks the web process/version, not full database/provider readiness. Verify an authenticated read against the existing database before cutover.
- Design preview is disabled on Render, as in Vercel production.
- User attachments are already stored in database rows. No new local persistent storage is introduced. Temporary filesystem content, caches and generated local downloads are not durable on Render Free.

## Reminder scheduling without a paid Render cron

`.github/workflows/reminders.yml` calls the actual existing authenticated reminder job hourly. It is not keep-alive polling, does not send emails independently, and does not bypass preferences or duplicate prevention. The job runs through the same existing reminder/mail queue logic.

Configure repository variable `AUTOCARE_APP_URL` with the actual HTTPS Render origin and repository secret `CRON_SECRET`. Do not put the secret in URLs or logs. The request rejects redirects and waits up to 150 seconds to allow a cold start. The workflow times out after five minutes and reports failure accurately.

**Activation is not automatic from the feature branch.** GitHub scheduled workflows run from the default branch. Review and merge/copy this exact workflow plus its script to that branch before enabling scheduling. Test with workflow_dispatch first. GitHub Actions minutes, free-tier conditions and account scheduling limits apply; scheduled runs may be delayed. This is not an exact-time or unlimited/free delivery guarantee. Do not run a second scheduler for the same deployment without reviewing concurrency; database deduplication remains in place.

## Cost and availability boundaries

Render Free can sleep after 15 minutes without requests and can take approximately one minute to wake. Monthly compute, bandwidth and build limits apply. Render explicitly does not recommend Free instances for production applications. This setup is a cost-constrained launch/testing option, not a promise of paid-tier uptime. External database, email, AI usage and Stripe transaction charges retain their own terms. Purchasing a domain later is separate from hosting.

## Acceptance before announcing a migration

- Verify the actual Render service plan is Free and no paid service/database/disk was created.
- Record the real deployment URL and deployed commit from `/api/app-version`.
- Confirm login, ownership permissions, garage/records/files reads and existing verification settings.
- Verify mobile dashboard/header/composer sizing at 320, 390, 768 and desktop widths, with no header/footer overlap.
- Exercise the reminder endpoint using its private token; verify real queue/provider outcomes, not a simulated success.
- Validate all six Stripe plan/currency combinations in Test Mode, webhook signature handling, renewals and existing-subscription guards before activating EUR/live checkout on the new host.
- Confirm AI and email failures are honest when credentials or provider quota are missing.
- Update installed mobile applications separately; keep existing Vercel configuration and database intact until acceptance.

## Validation performed locally

249 automated tests passed, including external-database startup validation and custom-domain origin regressions. TypeScript, lint and the full production build passed. YAML syntax was checked; the Blueprint defines exactly one free service and no database. Startup and scheduler also failed explicitly when secrets were missing, without creating data or printing secrets. No Render deployment, real email send, payment, real-device test or production data migration is claimed.

References checked: https://render.com/docs/deploy-nextjs-app ; https://render.com/docs/blueprint-spec ; https://render.com/docs/environment-variables ; https://render.com/docs/free ; https://render.com/docs/node-version

Render plugin installation/connection was confirmed in the conversation and plugin inventory, but no Render administration tools or Render skill were exposed in this session after repeated discovery. No service or account setting was created through that integration.
