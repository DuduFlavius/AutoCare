# SmartDrive GPS 3.0 — release gate and validation

Status: PUBLIC RELEASE REQUESTED BY THE FOUNDER BEFORE REAL-DEVICE VALIDATION. Automated checks passed; visual and real Android driving checks remain unverified.

## Entry point

The live SmartDrive entry is the `Plan întreținere` workspace tab (labelled SmartDrive GPS). Following the founder's explicit instruction to publish GPS first, authenticated accounts now receive the new navigation and recording workspace. `smartDriveEnabled=false` retains the maintenance fallback for rollback. Existing API ownership checks and subscription permissions are unchanged. Design fixtures remain read-only.

URL query: `/cont?tab=Plan%20%C3%AEntre%C8%9Binere`.

The real-device checks below are still required; publication is not evidence that they passed.

## Implementation

- Map-first desktop layout: 76% map / 24% search and journey sidebar. Mobile uses a map with compact overlays.
- Available height uses visualViewport and the actual mobile dock. Bottom overlay height is observed to reserve separate control positions.
- Existing vector provider geometry, labels and attribution retained; day/night palette applied in place, without reloading route sources for every GPS reading.
- Auto day/night is a local-clock rule (07:00–19:00), not a solar/sunrise calculation. Manual override available.
- 3D extrusion only for the provider's building source and render_height fields. Missing heights are zero, never synthesized. WebGL failure uses explicitly labelled 2D fallback.
- Following camera uses movement bearing, shortest-angle smoothing across north, 52-degree pitch, lower screen position and speed/turn-aware zoom. Stationary noise and inaccurate fixes cannot rotate the camera.
- Live recording and guidance share the same SmartDrive session and selected vehicle. Start guidance starts recording; end guidance stops recording and invokes the existing save path.
- Search suggestions debounce by 650ms, cancel stale requests, use real provider results, and retain per-account device-local recent/favorite/Home/Work destinations. These destinations are not cross-device synchronized.
- Voice prompts use browser speech synthesis where supported. Native background guidance remains the existing Android service; new UI has not been tested on an installed build.
- Save success requires matching trip/vehicle response and a confirmed mileage reading when sync is enabled. Existing transaction lock, UUID deduplication and sub-kilometre carry remain unchanged.
- No traffic, lane guidance, speed limit or road coverage data is fabricated. ETA is route-provider estimated travel time, without live traffic.

## Providers and configuration

- Vector map: OpenFreeMap Fiord, https://tiles.openfreemap.org/styles/fiord. Public usage requires no key; keep attribution. The public service is provided as-is, not a contracted SLA.
- Search: AUTOCARE_GEOCODER_URL, default https://photon.komoot.io/api/. The public instance is a limited demo service. For production scale, supply a compatible hosted/self-hosted Photon endpoint with capacity suitable for the application.
- Routing: AUTOCARE_ROUTING_URL, default https://routing.openstreetmap.de/routed-car. Supply a compatible production OSRM endpoint for contracted capacity.
- Existing per-user endpoint limits remain 12 destination queries/minute and 8 route queries/minute. No dummy credentials or new paid subscriptions were added.

Live provider checks used fixed synthetic public coordinates in Timișoara, not an account's private GPS position: routing returned 2 routes, first 2,183.3m with 8 steps; geocoding returned 6 results. These checks establish API availability, not real driving accuracy.

References:
- https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/
- https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/
- https://openfreemap.org/quick_start/
- https://openfreemap.org/tos/
- https://github.com/komoot/photon

## Automated checks

Camera tests cover crossing north, standstill, weak accuracy, signal gaps, derived bearing and speed/turn zoom. Storage tests cover invalid coordinates and deduplication. Existing GPS tests cover drift, teleport rejection and signal gaps; integration tests cover idempotent trip saves, kilometre carry, conflicting odometer updates and preservation of service records. Java harness tests cover native guidance progress and missed turns. These are simulations, not physical Android tests.

## Blocking checks before public release

- Real screenshots at 360, 390, 430, 768, 1280 and 1920px. Verify no overlapping overlays, correct keyboard treatment, visible attribution and legible streets.
- In-car Android drive, conducted safely by a passenger/test operator: straight road, left/right turns, roundabouts, highway speed, stationary, lost location and lost network, resumed session, end/save, verified odometer and no duplicate saves on retry.
- Day/night and 2D/3D controls on a real WebGL-capable phone, including bearing forward in actual motion and recenter after manual pan.
- Installed Android foreground service notification and location permissions, lock-screen/background recovery and battery restrictions.
- Authenticated founder Preview login and trip save against an explicitly chosen test vehicle.

Environment limitations observed: connected browser could not attach to this session; no adb/real device available. Android Gradle build failed while obtaining Gradle 8.14.3 because network access to the distribution was unavailable. No APK/AAB was built or installed. Do not mark these checks as passed.
