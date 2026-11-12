# AutoCare — product and Google Play audit, 12 November 2026

## Release decision

**NOT READY FOR GOOGLE PLAY.** The web update and Android source preparation are separate deliverables. No signed release AAB or real-device certification was produced in this environment. Do not upload an unsigned bundle or label a debug APK as a release.

## Implemented in this update

- Dashboard retains original navy/graphite/light blue palette, vector vehicle symbols and real owner-scoped records. Six actionable indicators: active vehicles, configured/planned maintenance, monthly recorded costs, latest recorded mileage, documents needing attention and maintenance completeness. The maintenance indicator is not a mechanical inspection or an invented manufacturer assessment.
- Financial overview, selected garage vehicle, three recent activities, important documents and next maintenance remain separate purposeful panels. Compact links expose actual SmartDrive trips, unread notifications and reports. AI remains Premium-gated by existing backend enforcement.
- Header breadcrumb, visible RO | EN segmented controls in private header/sidebar and public pages, selected-state contrast, 40–42px touch targets. Mobile uses two statistic columns and a single content flow; account and logout remain in account/navigation when the compact header hides their duplicate buttons.
- 73 reviewed dashboard strings centralized. Existing static application/public translation checks retained. Account-scoped language API validates RO/EN, rejects foreign origins and arbitrary account identifiers. Local preference survives logout. A non-sensitive preference cookie carries the selected language into signup/reset email rendering. Account deletion also removes this preference.
- All 47 system email templates now have reviewed English title/body/CTA, localized HTML language, plain text and footers. Default campaign fields localize; deliberately authored campaign content and vehicle names remain unchanged. Newly scheduled reminders use the account language. Historical saved messages are not rewritten. Mail delivery configuration/consent/retry rules are unchanged.
- Android Capacitor server URL corrected from the suspended Vercel host to https://autocare-jglt.onrender.com/cont. Android version 1.4.0 / code 12. Application ID unchanged: ro.autocare.garage. Android native sync completed successfully.
- Native verification workflow includes the actual deployment source branch. Automatic pushes build debug APK/unsigned verification bundle only; signed release requires explicit workflow_dispatch and release signing secrets. It does not submit to Play.
- No production data, prices, Stripe products, authentication rules or financial formulas changed.

## Architecture and native capabilities

| Area | Audited state | Outstanding validation |
| --- | --- | --- |
| Android | Capacitor 8.6.0 shell with remote HTTPS web app; not a standalone offline app | Verify release on Android hardware |
| SDK | min 24, target/compile 36; Java 21 | Resolve Gradle/SDK downloads in a build-capable environment |
| Signing | Existing external upload-keystore environment configuration retained | Actual upload key and protected release secrets required; preserve existing installed-app signature |
| Icons/splash | Existing branded mipmap sizes, adaptive launcher and splash resources retained | Check rendering on installed release; Play icon/feature graphic still need final export/review |
| GPS | Existing native foreground service and background AutoDrive tracking plugin | Real foreground/background, force-stop, battery restriction and permission-denial tests |
| Bluetooth | Existing native vehicle-device pairing/AutoDrive integration | Real car device, permission denial and reconnection tests; no browser simulation |
| Notifications | Existing web push and native tracking service notifications | General native FCM push is not configured; no google-services.json/PushNotifications integration present |
| Documents/camera | Existing web upload and attachment paths preserved | Android WebView file chooser/camera/photo picker require hardware checks |
| Authentication | Existing Better Auth sessions and HTTPS origin protection | Installed app login/logout/reset, expiry and WebView cookie persistence checks |
| Offline | Existing local native trip persistence and online synchronization | Airplane mode, restart, pending trip sync and conflict checks on real hardware |
| Premium billing | Existing Stripe web checkout unchanged | Google Play Billing or eligible/enrolled alternative billing program must be implemented/verified before Play distribution of paid digital features |

## Tests and evidence

TypeScript, ESLint and production Next.js build passed during implementation. Baseline full isolated suite: 251/251 passed with concurrency limited to two. Additional English-email and locale security tests were added. Final full suite after the new email/locale tests: **255/255 passed**, no skips. Focused integration rerun: 33/33 passed. TypeScript, ESLint and production build passed. Tests use isolated local databases, never production vehicles or real charges.

`npx cap sync android` succeeded and found the real autocare-native-tracking plugin.

Actual local `./gradlew :app:bundleRelease` failed downloading Gradle 8.14.3 with `java.net.SocketException: Network is unreachable`. Therefore no local release bundle exists. Signing and physical Android/iPhone testing were not performed. Browser checks of authenticated layouts and every individual user action are not certified by static translation checks or unit tests.

## Mandatory release gates

1. Build signed release AAB with the existing upload key; verify signer and install a release APK generated from it or test through Play internal testing.
2. Test compact/large Android phones, keyboard, safe insets, Back navigation, forms, file/camera upload, long AI answers and offline recovery. Test GPS while switching pages/backgrounding, weak/denied location and Bluetooth reconnect with real hardware.
3. Implement compliant Play billing or complete applicable alternative-program requirements. Keep website Stripe behavior unchanged. Simply placing Stripe inside a WebView is not evidence of Play compliance.
4. Complete background-location disclosure, permission declaration and demonstration video where required. Do not request broad background access without the actual feature need.
5. Decide and provision native push credentials if native general notifications are part of launch scope. Verify permission denial and delivery on real devices.
6. Confirm developer legal identity/contact, privacy policy, data deletion URL and processor terms. Complete Data Safety and IARC questionnaires from actual release behavior and SDK inventory.
7. Capture actual installed-release screenshots; do not substitute concept mockups. Final Play icon/feature graphic, release notes, support contact, reviewer login and testing-track requirements must be completed in Play Console.

## Official requirements reviewed

- Payments: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en
- Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Background location: https://support.google.com/googleplay/android-developer/answer/9799150?hl=en

No claim of complete page-by-page translation certification, real-device testing or store approval is made. Static copy coverage is distinct from live rendered review, especially historical notification text and custom campaign/user content.
