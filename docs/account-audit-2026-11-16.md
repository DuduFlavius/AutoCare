# AutoCare account, alerts and distribution audit — 16 November 2026

## Implemented and verified locally
PASS — 299 automated regression tests. After final security-email changes, 57 authentication/mail tests passed again. TypeScript, ESLint and production web build passed. Test mail is captured by an isolated mock provider; it is not real delivery evidence.

Account Settings now groups personal details/display name, verified email change, password change/confirmation/visibility, session listing/revocation, per-category alerts, personal data export, privacy links and permanent deletion. Existing language, channel and marketing preferences remain in Settings. Display-name changes update support message attribution without changing roles. Tests exercise Founder, Administrator, Assistant and Client ownership and injection rejection.

Email changes require approval at the verified old address and verification of the new address. The user ID is preserved and the old address receives a security notice. Password updates issue a security notice without sending the password. Account deletion requires explicit typed confirmation, identity verification and a final email link expiring in 30 minutes. A verified active Stripe cancellation is required before deleting the database account; Google Play cancellation is separate. Public deletion instructions are available in Romanian and English at /stergere-cont and /en/delete-account, with canonical/hreflang metadata and sitemap entries.

ITP/RCA/vignette/service preferences are checked before scheduling and again before transporting expiry reminders. A 15-day option is supported alongside 30/7/1 and existing Premium options. Chat/update/informational account preferences are respected by their transports; essential authentication security mail is separate. Reminder deduplication is preserved. Mail Studio accepts custom template and category labels as well as the existing custom communication type, subject and message; delivery consent classification remains administrative/promotional.

Android distribution defaults to direct installation with Stripe. Only an explicit -PautocareDistribution=play registers native Play Billing. Release code is 1.5.1, versionCode 16; an official installer must use the owner's existing production signing key. No new production installer or signature is claimed by this audit.

## GPS
PASS — existing automated native high-accuracy, exact-vs-approximate permission, real accuracy display, drift/teleport filtering, recovery and sync tests. No fake 2,000-m precision override was introduced. Background tracking still belongs to the native Android location foreground service.
NETESTAT — physical Android phones, locked-screen GPS/Bluetooth, real route distance and vendor power management. No physical phone is attached to this environment.

## External delivery and publication limits
NETESTAT — actual test-account inbox/push receipt, Firebase registration and real Stripe/Play payments. No real payment, real-user deletion or bulk email was performed.
DNS direct resolver was unavailable in this execution environment. Public Google DNS returned no DMARC TXT record for _dmarc.autocareapp.ro. This does not establish the sending Gmail account's SPF/DKIM/DMARC status. Actual message headers and the configured sender must be checked before declaring authentication PASS.
NETESTAT — full responsive visual review. Local Chromium launch was blocked and the alternate browser binary download failed. CSS and component behavior checks are not substitutes for full visual/real-device QA.

Google Play publication remains NOT READY until owner signing/Firebase/Play configuration, license tests, disclosures and physical-device checks are completed. SEO improves relevant discovery, but cannot guarantee rankings, indexing or appearance for every vehicle-related search.
