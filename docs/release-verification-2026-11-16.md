# AutoCare release verification — 16 November 2026

Verdict: NOT READY FOR GOOGLE PLAY.

Verified: 291/291 automated tests passed with --test-concurrency=1; default concurrent run had six test-process failures. TypeScript and ESLint passed. Next production build passed. Public crawl: 72 URLs returned 200. Support isolated DOM suite passed 99 API interactions, including customer alerts, assignment, closure, trash and restore. DOM checks use simulated APIs, not real delivery. Homepage inspected in live desktop browser. Full mobile visual QA not completed: local Chromium failed to launch due to prohibited Unix sockets.

Changes in this PR: improved RO/EN signup welcome copy; wait for active service worker before notification test; show activation/test failures; Android CI includes lintRelease, testDebugUnitTest and archived quality reports.

Android compilation attempted after provisioning Java 21 compiler; stopped because Gradle dependency downloads cannot reach Maven in this execution environment. No new APK or AAB produced by this verification. No signed installer published. Site still advertises 1.2.1 in release manifest. Release signing credentials unavailable locally. Target SDK 36 matches current official Play requirement: https://support.google.com/googleplay/android-developer/answer/11926878

Outstanding: native remote notifications while APK is closed (current Web Push does not provide this in Android WebView); physical Android GPS/Bluetooth/background and permission tests; real email/push delivery to test account; full visual desktop/mobile review of authenticated screens; signed APK/AAB with existing owner key; Play billing eligibility/implementation review and Console disclosures/test track. No production DB/settings or production deployment changed by this PR. Welcome is queued once at account creation; anonymous visitors cannot receive email without an address.
