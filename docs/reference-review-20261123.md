# AutoCare reference review — 23 November 2026

## Scope

Continue the existing Pearl White / Petrol implementation using the two supplied desktop/mobile reference boards. Keep actual account data, real service responses, access control and existing Android signing identity.

## Changes

- AI: conversational welcome bubble, compact suggestions, Pearl assistant messages, Petrol user messages, circular send action, compact toolbar with New conversation retained in the menu on narrow phones.
- Support: direct conversation entry; functional Conversation / My requests / FAQ navigation. Requests open the existing authorized threads. Team moderation and inbox remain available for staff.
- Support bubbles include a separate vehicle mark, readable names/roles and existing timestamps, receipts and file actions. No fabricated operator messages or online status.
- Shared primary buttons, individual mobile Settings cards and confirmation dialogs follow the rounded Pearl / Petrol reference. Confirmation retains Escape/cancel, focus trap, inert background, async errors and double-submit protection.
- Mobile chat retains the bottom dock, reserves its measured height and hides it when visualViewport reports the keyboard. Only message history scrolls.
- MapLibre GPS previously called Marker.setLngLat immediately while separately animating the camera. Measured-fix interpolation now updates marker position, bearing and follow camera in one requestAnimationFrame loop, without React updates per frame. Manual dragging cancels follow. No extrapolation, and impossible jumps are rejected. Long signal gaps do not animate invented travel.
- Native duration previously refreshed with the two-second snapshot poll. A separate one-second display clock now advances it from the last timestamp-based snapshot, including frozen waiting/stopped/disconnected states.

## Validation

- 359 automated tests passed, including interpolation endpoints, impossible jumps, signal gaps and north/date-line crossings.
- ESLint passed.
- Production build and TypeScript passed.
- These results do not constitute visual approval or physical Android/road testing.

## Outstanding acceptance checks

- Compare rendered desktop, 390px and 320px previews, including narrow toolbar, request tabs and confirmation lifecycle.
- Validate a real signed-in AI answer and support exchange; local design previews deliberately disable live submissions.
- Test keyboard, foreground/background, lost signal and road motion on a physical Android device. No such tests are claimed here.
- The complete attached SmartDrive specification remains a separate acceptance list: native pause/resume semantics, moving/stopped/maximum/average-speed diagnostics and raster fallback motion still require a dedicated functional review. This change must not be presented as completion of the entire GPS specification.
- Production publication remains subject to the final approval requested in the attached instructions. A design Preview does not replace the public Production deployment.
