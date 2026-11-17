# Android Firebase client configuration

`google-services.production.json` contains the public Android SDK identifiers for
`autocare-a1239` / `ro.autocare.garage`. These identifiers are embedded in the APK;
this file is not a server credential and does not authorize sending notifications.

The release workflow copies this configuration to the ignored Android app path.
An existing `AUTOCARE_GOOGLE_SERVICES_JSON_BASE64` CI secret remains an optional
override. `scripts/verify-android-firebase.mjs` validates the selected project and
package and rejects a service-account credential.

Keep all private service-account keys out of this directory and Git. Configure
server authorization separately in the deployment's secret environment.
