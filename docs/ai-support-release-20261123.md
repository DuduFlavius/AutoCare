# AutoCare Premium 5 — AI, Support and SmartDrive release

The owner explicitly requested production publication of the grouped work on 23 November 2026. Keep the existing protected access and maintenance exception. Do not create a shareable Preview link.

## AI

- Full-width Pearl conversation panel with a desktop welcome composition: greeting and suggestions on the left, a generic outlined vehicle illustration on an angled Petrol panel on the right.
- Mobile shows the AI title, subtitle, Back, vehicle picker, History/New conversation/menu actions and a compact welcome card. The illustration is desktop-only.
- Vehicle selection is below the conversation heading. The greeting uses the signed-in display name when provided, without hardcoded sample account data.
- Petrol user bubbles include discrete timestamps. Assistant responses retain readable paragraphs, lists, horizontally scrollable tables, copy/regenerate/feedback actions and timestamp.
- A separate input pill includes the real document attachment action; a circular send action sits beside it. Message history is the scrolling region; visualViewport and dock measurements reserve space for the composer.
- Existing AI integration, vehicle-scoped history, request cancellation, Premium checks, document confirmation, errors and model settings remain in place.

## Support

- Desktop default: Conversations list, Submit request and FAQ tabs. Mobile default: Conversation and My requests tabs; FAQ remains available from My requests.
- Customer request cards use real titles, last messages, localized timestamps, unread counts and open/closed status. No sample conversations are inserted.
- Opening a card switches to the real conversation. Submit request uses the existing server behavior: continue the current open request, or create a new one when appropriate. It does not silently create duplicate active threads.
- The staff inbox retains its existing role checks and management tools. History mode no longer hides the entire staff panel.
- Added date separators. Real names, role labels, timestamps, receipts, uploaded files and message synchronization are preserved.
- Attachment input is inside the message pill, next to the separate circular send action. The first attachment remains unavailable until the server has an actual thread, matching existing behavior.
- ResizeObserver recalculates available chat height after tab changes as well as viewport/keyboard changes.
- No conversations or account data were deleted, no database migration or operational-data change was performed.

## Grouped SmartDrive work

Includes the previously local `4c3e231` session-panel implementation: large speed display, persistent metrics, timestamp-based active duration, pause/resume/finalize and single mileage synchronization. Android native changes require a newly compiled application; this web publication is not proof that an Android installer has been built or installed.

## Verification and limits

- Both supplied reference images were opened and their visible structure was used to guide the source changes.
- 365 automated tests passed, including support access control and session/mileage checks.
- The real AI/Support components passed the additional server-rendered markup audit: accessible controls, desktop/mobile tab labels, staff inbox visibility, Premium gate and safe list/table markdown rendering.
- ESLint, TypeScript and the final web production build are required before publication; their completion is confirmed in the release execution.
- There is no claim of a completed pixel-by-pixel comparison or authenticated browser screenshots. The local browser/file route was blocked earlier, and the user declined a shareable Preview. Protected access was preserved.
- Physical Android keyboard/background behavior and the new native pause/speed code remain unverified. The local Android wrapper download failed due to unavailable network access. The existing signing key was not replaced and no unsigned/debug installer was published.
- Only the final combined production deployment is requested. Its actual result and domain aliases are checked through Vercel after creation.
