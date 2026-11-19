# AutoCare AI viewport layout repair — 2026-11-19

## Source preservation
Started from the current remote branch `feature/autocare-ai-integrated`, commit `711aae9`, after checking Render's last live deployment (`ed593d9`, Nov 18). The branch contains newer work than that deployment. All newer branch changes are retained. Backup branch: `backup/pre-ai-layout-2026-11-19`.

Only two production files change: `auto-ai-workspace.tsx` viewport measurement and `auto-ai-premium.css` scoped chat layout. No AI API, database, billing, message persistence or user records change.

## Repair
- The chat page is a vertical flex container; its layout and main region shrink with `min-height: 0`. The message region is the flexible vertical scroller.
- Remove the child chat's competing 100% height and the root's competing grid tracks. The vehicle selector stays a non-shrinking row.
- Reserve visible viewport space below the page's actual top, the fixed mobile navigation and the existing bottom/safe-area padding. Do not impose a minimum height larger than the available viewport.
- Observe the actual application topbar instead of the first arbitrary header. Existing visualViewport resize/scroll listeners and cleanup remain.
- Remove the mobile fixed overlay and topbar-hiding rule. Preserve the application header and bottom navigation. Keep Cost/Maintenance/Documents visible in compact mode.
- Keep the current navy/purple design and all chat actions and conversation behavior.

## Validation before publication
- Production build passed; ESLint passed. Automated suite: 333 passed, zero failed.
- Browser QA used the real React AI component, real ApplicationHeader/MobileNavigation and current global/dashboard CSS, with 18 long synthetic conversation turns. No production data was added, changed or deleted; no provider request was made by this fixture.
- Verified viewport sizes: 1366x768, 1920x1080, 390x844, 360x740 (English), and constrained-height 390x500.
- 1366x768: header y190.59–271.64; messages y271.64–530.5 (7648px content, 259px viewport); quick actions y530.5–579.5; composer y579.5–641.5. Root bottom756, inside768.
- 1920x1080: composer y891.5–953.5; root bottom1068, inside1080. Full design inspected using a scaled outer preview; iframe viewport remains1920x1080.
- 390x844: global header bottom88, mobile dock begins776, composer bottom660.06. No overlap with navigation.
- 360x740: composer bottom556.06, mobile dock begins672. English header wraps within the available space.
- 390x500: composer bottom384, dock begins432. Quick actions remain visible.
- Scroll test at1920x1080: message scrollTop7077→5205 while chat header y190.59–271.64 and composer y891.5–953.5 remain unchanged.

## Limits
The physical iOS/Android keyboard and real-device safe-area insets were not tested. The constrained-height viewport exercises layout, not a physical keyboard. The signed-in production browser account has no vehicle, so Premium conversation layout was verified in the isolated real-component fixture rather than by creating production records.

## Follow-up validation of the current dashboard Back control
The fixture now passes `onExit`, matching the current dashboard. At390x844 the message area remains265.52px tall, composer bottom660.06 and dock top776. At390x500, the old compact selector targeted only a direct child and missed the newer vehicle-header wrapper. The compact rule now hides the nested vehicle label (not the Back control); the message area remains67.95px tall, composer bottom384 and dock top432. This was visually rechecked before publishing the final compact-rule adjustment.
