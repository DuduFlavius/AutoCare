# AutoCare 1.5.0 — release verification, 16 November 2026

## Result
NOT READY FOR GOOGLE PLAY until account configuration and physical-device tests below are complete. This change is prepared for review; no production deploy or store submission performed.

## Implemented
- Android FCM token registration authenticated to the current account, explicit permission, notification channel, foreground/background payloads and automatic registration recovery. Logout clears displayed alerts and unregisters the device. Account deletion cascades tokens; invalid tokens are removed.
- Play Billing Library 8 native subscription purchase and restore. Native checkout uses Google Play, not Stripe. Server verifies exact package, allowed product, hashed account identity, purchase state and expiry, then acknowledges completed purchases. Pending/held/expired purchases do not grant access. Active existing subscriptions block a second purchase. Extensions/plan changes are not supported by this integration.
- Authenticated Pub/Sub RTDN receiver for renewals, cancellations, holds and refunds. Only token hashes are stored. Private service accounts stay server-side.
- New entitlement and native-push migrations, with compatible encrypted backup/restore.
- Existing support refinements, signup welcome RO/EN copy and notification error handling preserved. Android installer entry reads the existing release endpoint.
- Android API compatibility fix: navigation-bar styling requiring API 27 now lives in values-v27. CI runs release lint and unit tests, checks signatures, and archives quality reports.

## Verified
- 295/295 automated tests passed, serial runner. Includes new account-bound Play entitlement, pending/expired/held states, native token isolation/revocation, backup/restore and existing application regressions.
- TypeScript, ESLint and production Next build passed.
- Android assembleDebug, bundleRelease, lintRelease and testDebugUnitTest completed successfully. Lint: 0 errors, 14 warnings (mostly existing assets/backup/theme advisories); no warning suppression introduced.
- Preview APK: ro.autocare.garage.preview, 1.5.0-preview, versionCode 15, min SDK 24, target SDK 36. APK signature verified (debug/test certificate). AAB is unsigned and cannot be uploaded as a release.
- Earlier live public crawl: 72 URLs, all HTTP 200. Support DOM fixture: 99 simulated API interactions. These are not proof of actual email/push delivery.

## Still required
1. Configure matching Firebase apps for production and preview packages. Provide Android google-services.json (CI secret AUTOCARE_GOOGLE_SERVICES_JSON_BASE64) and server AUTOCARE_FIREBASE_SERVICE_ACCOUNT.
2. Configure three Play subscription products/base plans at the existing catalog amounts, Android Publisher service-account access, authenticated Pub/Sub RTDN and license testers. Set server secrets described in mobile/README.md. AUTOCARE_PLAY_BILLING_ENABLED must stay disabled until the real purchase/restore/renewal/refund tests and localized price review pass.
3. Supply the existing release upload key through the android-release GitHub environment. Signed builds fail if signing/Firebase configuration is missing. Never replace the old public installer with a debug/unsigned release.
4. Apply migrations 0016 and 0017, deploy reviewed server/client changes, then run real test-account email/push deliveries. New APK still loads the hosted website: unmerged web code is not embedded in this preview.
5. Physical Android GPS/background/Bluetooth, denied/revoked permissions, force-stop, offline recovery, keyboard/layout checks, real notification taps, purchase cancellation and license-test refund/revocation. Full mobile visual review is not completed; local Chromium was blocked by execution-environment Unix-socket restrictions.
6. Complete privacy/Data Safety/background-location disclosures, Play Console testing and store review. No store acceptance is claimed.

The APK is a separate preview application; do not remove an older install with unsynchronized local trips.
