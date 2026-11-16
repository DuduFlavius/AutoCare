# AutoCare: mobile chat, PWA, mileage and printed identity

## Implemented
- Mobile AI occupies the visual viewport, accounts for the on-screen keyboard offset and safe areas, hides the ordinary topbar/dock only in chat, provides visible New chat and Close actions, and uses a short RO/EN placeholder. Enter still sends; the keyboard shortcut hint is removed. Existing conversations/provider integration remain.
- Mobile settings expose personal data/account deletion through the existing protected account workflow. Existing subscription cancellation and password/typed-confirmation checks remain.
- PWA manifest has stable identity, scope, standalone mode and the existing icons. The service worker is registered on public and account pages, checks for updates without caching private HTML/APIs, and removes only obsolete AutoCare offline caches. Existing active-GPS/dirty-form reload safeguards remain.
- Apple launch images generated from the existing icon for eight portrait screen sizes; bounded dimensions prevent arbitrary image-generation sizes. Install instructions explain iPhone Web App installation and push requirements. APNs push endpoint validation accepts Apple's push.apple.com hosts while retaining HTTPS/host checks.
- Map location requests fresh high-accuracy fixes with a longer timeout, keeps a better recent fix instead of replacing it immediately with a much poorer one, and lets the user retry. Hardware accuracy cannot be guaranteed. Existing <=50 m distance acceptance, jump filtering and gap boundaries remain.
- Manual readings include date and optional notes, confirmation, future/invalid-date and regression rejection, transaction/ownership protection and same-day retry deduplication.
- GPS mileage synchronization also records a GPS-source odometer reading inside the existing trip transaction. Existing trip IDs, retry deduplication and concurrent-odometer guards remain.
- Daily declared usage is a separate calendar-day estimate derived from a stable anchor and latest confirmed reading. Refreshes do not add it repeatedly. It does not fabricate confirmed GPS kilometers.
- Generated vehicle/service/document/expense PDFs share an A4 renderer with the existing icon, Unicode fonts, repeated brand header/footer, page numbers, actual category sums, known/unknown cost distinction, and chronological tables. Service export is labeled Service sheet. Preview/Print opens the same PDF. Original uploads are never branded or edited.
- Additive migration 0015 adds optional notes and permits the GPS source. No user data is deleted. Backup branch: backup/pre-pwa-gps-reports-2026-11-16.

## Verification and limits
- Production build, TypeScript, ESLint and isolated automated suite are checked before publication; exact counts recorded with deployment evidence.
- Four isolated PDF fixtures: one car/two records; two cars/eight records; two cars/90 records with long notes (25 pages); empty selection. First and final pages of the long fixture inspected as PNG. Romanian diacritics and date-column wrapping checked. Fixtures never inserted into production.
- Apple PNG generation exercised directly, including invalid-dimension rejection; manifest icon signatures checked. Existing support interaction regression script is rerun separately.
- Local production server cannot run in this sandbox because Node's network-interface enumeration is denied. Browser visual/layout and real Safari keyboard tests are not completed here. Direct route tests and build checks do not substitute for them.
- No physical Android/iPhone available: driving, screen lock, app switching, native background behavior, actual APNs delivery, camera and device-specific auth must still be validated on real devices.
- No new signed AAB/IPA produced; store readiness is NOT asserted.
- Browser/PWA background GPS is not guaranteed. Existing native services require OS permissions and real-device tests. GPS route geometry remains device-local; saved trip summaries and odometers are backend-synchronized.
- Explicit separate Pause/Continue controls and active-time accounting still need work; existing Stop/Resume behavior is not claimed equivalent.
- Dedicated GPS/mileage report exports and the remaining document-vault filter/print audit are not completed by this release. Existing record-based reports share the new renderer.
- The full cross-page audit requested by the user is not complete. Existing free Render sleeping/robots behavior is a hosting limitation and is not changed by this release.
