# AutoCare — native GPS builds (Android + iOS)

Extends the existing AutoCare website and backend. This is not a separate replacement app. Capacitor loads only the existing HTTPS application; there is no wildcard navigation or new authentication system.

## What runs natively

- Android location foreground service with ongoing notification and Stop GPS action. Started only after the user presses Start and grants precise location. Removing the activity from Recents does not explicitly stop the service. Android force-stop, process termination, permission revocation, disabled GPS and vendor battery restrictions can stop it.
- iOS Core Location automotive navigation with background location mode and visible system location indicator. Requires location permission. Force-quit/system termination stops tracking; relaunch recovers recorded data and does not silently restart tracking.
- Distance filtering, cumulative meters and recent route coordinates persist on-device without depending on JavaScript callbacks. GPS gaps are separate segments, never fabricated straight-line distance.
- The web interface reads native snapshots, resumes the same trip, and saves through the existing authenticated, idempotent trips endpoint. Saving remains explicit. Historical intervention mileage is untouched.
- Native tracking stops before account logout. Native snapshots are scoped to the current account. The native service does not store authentication tokens or upload coordinates.

## Build

Node 22+; Java 21 and Android SDK 36 for Android. Xcode 26+ on macOS for iOS.

```sh
npm ci --prefix mobile
cd mobile
npx cap sync
# Android debug APK:
cd android
./gradlew :app:assembleDebug
# iOS: open mobile/ios/App/App.xcodeproj, choose your own signing team.
```

The `Native GPS builds` workflow compiles Android and iOS simulator builds without production secrets. A debug APK is a test installation, not a signed Play Store release. The iOS simulator build cannot be installed on an iPhone. Physical iPhone distribution needs Apple signing and TestFlight/App Store setup; Android production distribution needs the owner's release signing key and Play Console setup. No store publication or account creation is performed by these scripts.

`server.url` is intentionally fixed to the existing production website because it has server-rendered pages and session-based APIs; it must not point to arbitrary hosts. This hosted-shell distribution requires a store-policy review, privacy disclosures, payment-policy review and real-device testing before publication. Do not add external domains to `allowNavigation` or enable mixed HTTP content.

## Required device verification before release

1. Sign in; Start GPS; grant precise location.
2. Drive a known-distance route. Compare recorded distance against the vehicle's trip meter.
3. Lock the screen for 10+ minutes. Reopen and check the distance and continuous route.
4. Minimize/switch sections; ensure native tracking continues. On Android test the notification Stop action.
5. Stop in-app; confirm distance stops changing. Save twice and confirm mileage increments once.
6. Deny/revoke permission, disable GPS, go offline, kill/force-quit, relaunch and recover the existing trip.
7. Sign out while tracking; confirm location service/indicator stops and another user sees no previous account's trip.
8. Validate oil/timing remaining kilometers after saving, preserving historical intervention odometers.

The installed PWA and desktop browser retain web-only tracking. A Vercel deployment alone cannot install these native services onto existing users' phones. Native SDKs and signing are separate from the web build.

## AutoDrive (opt-in)

Android uses the selected already-bonded car Bluetooth identity, without an OBD2 adapter. Only a real ACL connection for the exact configured address and account starts native GPS. Pairing or proximity alone never starts a session. Duplicate connection events reuse the current session. Disconnect finalizes immediately. Process recovery checks live A2DP/Headset profiles for the same address before recording; periodic checks catch missed disconnects. The manual Stop action suppresses restart until a real disconnect/reconnect.

Distance remains a GPS estimate, not an odometer reading. Automatic trips exclude samples without speed or below 2.5 m/s to reduce walking and parked drift; slow manoeuvres can be omitted. Background-location and notification permissions are required, and Android force-stop or vendor battery restrictions can stop automation. Physical vehicle testing remains required.

On iOS 16+, configure each vehicle in AutoDrive with Always + Precise Location. Then create personal Shortcuts automations: Bluetooth/CarPlay connection → `Pornește traseul AutoCare` / `Start AutoCare trip`, selecting that vehicle; CarPlay disconnection (or Bluetooth disconnection trigger where the OS provides it) → `Încheie traseul AutoCare` / `End AutoCare trip`. Choose Run Immediately where offered. The app cannot create these personal automations or silently grant their permissions. Where iOS requires an unlock/confirmation, that step remains required. The user must complete this one-time setup; configuration alone is not proof that the automation is active.

Completed automatic trips are queued on-device without credentials. Metadata (distance and times, not route coordinates) syncs through the existing account session when AutoCare is visible again. Active trips are not synced mid-recording. The backend locks the vehicle, deduplicates IDs and checks the expected odometer before applying the whole batch. Conflicts pause sync; the user can archive that vehicle's trips without adding kilometers a second time. Historical service odometers are never modified. Logout disables associations before stopping GPS. Queue capacity is 200 completed trips; open AutoCare to sync before that limit.

Additional required tests: associate a real car, lock the phone, connect/disconnect twice, reconnect within two minutes, manually stop while still connected, revoke each permission, sign out, drive offline twice and reconnect, and verify that two trips sync once with the correct vehicle and no intervention-history changes. Simulator compilation cannot verify real Bluetooth events or locked-device App Intent execution.


## Google Play release preparation (1.1.0, versionCode 2)

The normal Android CI job now also compiles an **unsigned** release AAB to verify release packaging. It is explicitly not upload-ready. For a signed bundle, configure the `android-release` GitHub environment with the owner's existing `AUTOCARE_UPLOAD_KEYSTORE_BASE64`, `AUTOCARE_UPLOAD_STORE_PASSWORD`, `AUTOCARE_UPLOAD_KEY_ALIAS`, and `AUTOCARE_UPLOAD_KEY_PASSWORD` secrets. Run Native GPS builds manually with `signed_android_release` enabled. The workflow fails if any credential is absent, removes the temporary key after use, and never uploads the key. The release build is non-debuggable. Increase versionCode for every later Play upload; keep the same registered upload key.

Previous debug APKs used runner-generated debug certificates and are not a stable distribution channel. Do not advise uninstalling them before all pending local trips are safely synchronized. They are separate from the future signed Play release and must not be represented as automatically upgradeable.

Before store submission the owner must complete Play Console setup, app signing, the background-location declaration and demo, Data Safety/privacy disclosures, physical background/Bluetooth/GPS testing and the billing review for digital Premium subscriptions. Existing Stripe web billing is preserved; Play Billing or an approved eligible alternative needs separate implementation/configuration before a Play release with in-app Premium purchases. No Play upload or approval is claimed. The native permission disclosure now appears before location permission setup; location use remains opt-in.


## 1.2.0 preview checkpoint
Debug builds use applicationId `ro.autocare.garage.preview`, versionName `1.2.0-preview`, versionCode 7, to avoid replacing the installed production app. This APK still loads the configured hosted site; unpublished web changes are not bundled into it. Do not enable two automatic trackers for the same car. A production upgrade requires the owner's existing signing key; an unsigned release package is not an installer. No store publication or physical-device validation is claimed.

## 1.4.1 (versionCode 13): native map location and support controls

Android maps use `@capacitor/geolocation` 8.2.4 with high accuracy, a 1-second desired update interval and no cached fixes. The app requests the precise-location alias explicitly; granting only approximate location produces guidance instead of presenting a 2-km fix as precise. Existing APKs without this plugin keep the browser fallback until updated. Background trip tracking remains owned by the existing native foreground service. Foreground map watches stop when hidden and reacquire on return.

Customers can end their own support conversations. Customers and administrators can move active or completed conversations to recoverable trash, which stops new messages in that thread. Customer access stays restricted to their own conversations. No schema migration is needed.

The CI debug installer uses the `.preview` app ID and is for physical-device testing. The release AAB stays unsigned unless the owner's existing signing credentials are provided to the signed-release workflow. An unsigned AAB cannot be submitted to Play. Target SDK remains 36. Physical GPS, background behavior, signing, Play billing eligibility and Console declarations still require verification before store submission.

## 1.5.0: Android notifications and Google Play Billing

Native Android remote alerts use the Capacitor Firebase Messaging plugin. Server token registration is authenticated, user-scoped and removed on logout/account deletion. The server sends notification payloads so Android can display them while the WebView sleeps; delivery still depends on Android permissions, Google Play services and force-stop/battery rules. Configure the matching Firebase Android apps for `ro.autocare.garage` and the preview ID `ro.autocare.garage.preview`. Supply `google-services.json` locally or `AUTOCARE_GOOGLE_SERVICES_JSON_BASE64` in the signed-build GitHub environment. Set `AUTOCARE_FIREBASE_SERVICE_ACCOUNT` to the matching service-account JSON in the server's secret settings. Never put the private service account in the APK or Git. A build without Firebase configuration can compile but cannot register for remote notifications.

Play Billing Library 8 purchases subscriptions through Google Play and restores purchases from the signed-in Play account. The server checks package, allowed product, hashed AutoCare account identity, Google-reported state and expiry before granting access; pending purchases never unlock Premium. Tokens are verified on the server and only their hashes are stored. Verified purchases are acknowledged by the server. Renewals/refunds/holds/revocations require authenticated Google Pub/Sub RTDN at `/api/play-notifications`; test notifications and a real license-test purchase/refund must be verified before launch.

Server secrets/settings required:
- `AUTOCARE_PLAY_SERVICE_ACCOUNT`: service-account JSON with Android Publisher access to this app.
- `AUTOCARE_PLAY_MONTHLY_PRODUCT`, `AUTOCARE_PLAY_QUARTERLY_PRODUCT`, `AUTOCARE_PLAY_ANNUAL_PRODUCT`: three subscription product IDs with standard base plans; retain the existing catalog amounts when configuring Console.
- `AUTOCARE_PLAY_RTDN_AUDIENCE`: exact HTTPS webhook URL.
- `AUTOCARE_PLAY_RTDN_EMAIL`: email of the Pub/Sub push authentication service account.
- `AUTOCARE_PLAY_BILLING_ENABLED=true`: enable only after Console products, RTDN, license tests, current price display and refund tests pass.

Apply migrations 0016 and 0017 before deploying the web code. Existing Stripe website billing is preserved. Native purchases do not use Stripe checkout. Subscription upgrades/downgrades and prepaid extensions are not implemented in this release; validate the existing-account flow before enabling Play purchases. Native product availability and final localized payment terms are confirmed by Google Play. Signed production builds require the existing upload key and Firebase config; debug APKs remain preview-only and are not Play submissions.
