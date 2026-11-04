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

Android 8+ uses the selected already-bonded car Bluetooth identity, a system-approved Companion Device Manager association, notification permission and precise background location (Allow all the time). ACL connect starts only the configured vehicle; duplicate connects do not create another trip. Disconnect schedules a two-minute stop; reconnect cancels it. The persistent notification/in-app Stop is immediate and suppresses restart until a disconnect/reconnect cycle. Some cars must be in pairing/discoverable mode for the one-time companion association. Android/vendor force-stop and battery policies still apply.

On iOS 16+, configure each vehicle in AutoDrive with Always + Precise Location. Then create personal Shortcuts automations: Bluetooth/CarPlay connection → `Pornește traseul AutoCare` / `Start AutoCare trip`, selecting that vehicle; CarPlay disconnection (or Bluetooth disconnection trigger where the OS provides it) → `Încheie traseul AutoCare` / `End AutoCare trip`. Choose Run Immediately where offered. The app cannot create these personal automations or silently grant their permissions. Where iOS requires an unlock/confirmation, that step remains required. The user must complete this one-time setup; configuration alone is not proof that the automation is active.

Completed automatic trips are queued on-device without credentials. Metadata (distance and times, not route coordinates) syncs through the existing account session when AutoCare is visible again. Active trips are not synced mid-recording. The backend locks the vehicle, deduplicates IDs and checks the expected odometer before applying the whole batch. Conflicts pause sync; the user can archive that vehicle's trips without adding kilometers a second time. Historical service odometers are never modified. Logout disables associations before stopping GPS. Queue capacity is 200 completed trips; open AutoCare to sync before that limit.

Additional required tests: associate a real car, lock the phone, connect/disconnect twice, reconnect within two minutes, manually stop while still connected, revoke each permission, sign out, drive offline twice and reconnect, and verify that two trips sync once with the correct vehicle and no intervention-history changes. Simulator compilation cannot verify real Bluetooth events or locked-device App Intent execution.
