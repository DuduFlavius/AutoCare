# Gmail OAuth — Founder-only manual pilot

Branch: `feature/autocare-premium-rebuild`. Production project: `autocare.vercel`
(`prj_zsagj49xRF0qbIICeSaBRnoAo1NW`, Roomlyy), domain `project-sxage.vercel.app`.

## Configuration

Production requires `GOOGLE_MAIL_CLIENT_ID`, `GOOGLE_MAIL_CLIENT_SECRET`,
`GOOGLE_MAIL_REDIRECT_URI`, `GOOGLE_MAIL_FROM`, plus the existing `BETTER_AUTH_SECRET`,
`AUTOCARE_FOUNDER_USER_ID` and `DATABASE_URL`. Never expose these through NEXT_PUBLIC variables.
Redirect URI must exactly equal:
`https://project-sxage.vercel.app/api/v1/mail/google/callback`.
APP_URL must remain `https://project-sxage.vercel.app` for existing session/CSRF checks.
The intended sender is `contactautocare9@gmail.com`, already added as a Google OAuth test user.
Only `https://www.googleapis.com/auth/gmail.send` is requested/accepted.

## Founder workflow

1. Sign in on the production domain as the configuration-bound Founder.
2. Open **Panou Fondator → Setări administrative → Conectare Gmail**.
3. Click **Conectează Gmail**, choose the official mailbox and approve sending.
4. The clean return URL reports saved authorization without OAuth response parameters.
5. Click **Trimite email de test**. Test delivery goes only to GOOGLE_MAIL_FROM,
   at most once per minute. Confirm actual receipt in Inbox/Spam. “Last test sent”
   confirms Gmail API acceptance, not inbox delivery.
6. **Deconectează Gmail** deletes local authorization and outstanding connection state.
   Revoke access separately in the Google Account security settings if needed.

Google consent requires the account owner's interaction; deployment alone cannot complete it.
OAuth apps in Google's external Testing mode can have short-lived refresh authorization;
reconnect when Google invalidates access. Do not enable automatic notifications during the pilot.

## Security and storage

All endpoints authenticate a live session, check active-account status and call
`requireFounder`; a profile role cannot grant access. POST operations also require the
existing exact APP_URL origin. Connecting/callback/testing require the configured production host.
State is random, valid for 10 minutes, browser-bound with a Secure/HttpOnly/SameSite=Lax
host-only cookie, and tied to the current session. PKCE uses S256. Compare-and-delete in
Postgres makes callback consumption atomic and single-use. Cancellation consumes the state.

The existing settings table stores only AES-256-GCM envelopes (random IV and authenticated
context). The key is derived with HKDF-SHA256 and domain separation from BETTER_AUTH_SECRET.
State/PKCE values are encrypted too; access tokens remain transient in server memory.
No schema migration is needed. Only safe status fields reach the UI. Provider responses,
credentials and OAuth response parameters are never logged by application code.
Private Gmail settings are excluded from exported application backups. Database-native backups
can contain encrypted envelopes; protect database access separately.

Rotating BETTER_AUTH_SECRET requires Gmail reconnection (and already invalidates auth sessions).
Changing the OAuth client ID or sender also requires reconnection. No secrets are committed.
The sender is used as Gmail API userId so a different mailbox's grant cannot pass the test.
Only the configured sender is accepted as the test recipient; no arbitrary content/recipient API exists.

## Existing email and release checks

`src/lib/mail.ts`, password reset, verification email, Resend webhooks, reminders and cron
configuration retain their existing behavior. New Gmail automations require both explicit Founder
approval after testing and a separately enabled deployment gate; both remain closed in this release.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` with isolated local
configuration before production deployment. The OAuth tests mock Google and use in-memory
PGlite; they do not send email or access production data. After deployment, check anonymous
status/connect/test/callback requests are denied and mutating cross-origin requests fail.
Complete real consent and inspect a real test email from the Founder session before any
future decision about automatic Gmail delivery.

## Mail Center extension

See [MAIL_CENTER.md](MAIL_CENTER.md) for HTML/plain-text MIME, manual campaigns, consent, history, additive migration and the two closed automation gates. This pilot does not enable automatic Gmail delivery.
