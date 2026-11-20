# Pearl White + Petrol — implementation checkpoint, 20 November 2026

## Implemented in this change

- Central Pearl palette in the original design system, including body-level portals. Removed duplicated workspace color declarations.
- Migrated retired Racing Green fills and ink in source styles for shared controls, public/auth screens, garage, document tools, maintenance, finance, account, membership, admin, AI and human support.
- Kept map cartography and GPS native behavior separate from the UI palette. No account data, pricing, permissions or database changes.
- Home now includes four document tiles scoped to the selected vehicle and a real expense timeline with working period controls. No demo photos, telemetry, percentages or costs introduced.
- Current documents take precedence over future renewals; missing data is explicit. Added a regression test for vehicle isolation, cancellation and future renewal handling.
- AI uses readable Pearl assistant messages and Petrol user bubbles. Kept its viewport sizing, scroll region, history, attachments, model and access restrictions.
- Preserved the existing server-session maintenance exception for flaviusdudu4@gmail.com.

## Validation and limits

- 354 Node tests passed after the functional Home change.
- TypeScript, ESLint and the final production build passed.
- Automated tests are not Android device, road, payment-provider or live-AI validation.
- Connected browser: unavailable (originating extension context required).
- Native browser: localhost preview refused connection; cannot access the executor's local server. No authenticated account session used.
- Consequently **no page is marked visually approved**, and no Android screenshot or on-road GPS test is claimed.
- The following inventory is generated from every actual App Router page source. Dynamic parameter routes are listed as patterns. Route discovery does not mean its workflow was tested.

## Page inventory

| Route pattern | Source | Desktop | Mobile/Android | Visual approval | Live workflow |
| --- | --- | --- | --- | --- | --- |
| `/[slug]` | `src/app/(romanian)/[slug]/page.tsx` | Pending | Pending | Pending | Pending |
| `/admin` | `src/app/(romanian)/admin/page.tsx` | Pending | Pending | Pending | Pending |
| `/aplicatie-auto` | `src/app/(romanian)/aplicatie-auto/page.tsx` | Pending | Pending | Pending | Pending |
| `/autentificare` | `src/app/(romanian)/autentificare/page.tsx` | Pending | Pending | Pending | Pending |
| `/cont` | `src/app/(romanian)/cont/page.tsx` | Pending | Pending | Pending | Pending |
| `/dosar/[token]` | `src/app/(romanian)/dosar/[token]/page.tsx` | Pending | Pending | Pending | Pending |
| `/ghiduri/[slug]` | `src/app/(romanian)/ghiduri/[slug]/page.tsx` | Pending | Pending | Pending | Pending |
| `/ghiduri` | `src/app/(romanian)/ghiduri/page.tsx` | Pending | Pending | Pending | Pending |
| `/inregistrare` | `src/app/(romanian)/inregistrare/page.tsx` | Pending | Pending | Pending | Pending |
| `/instaleaza` | `src/app/(romanian)/instaleaza/page.tsx` | Pending | Pending | Pending | Pending |
| `/open-app` | `src/app/(romanian)/open-app/page.tsx` | Pending | Pending | Pending | Pending |
| `/` | `src/app/(romanian)/page.tsx` | Pending | Pending | Pending | Pending |
| `/previzualizare/controale` | `src/app/(romanian)/previzualizare/controale/page.tsx` | Pending | Pending | Pending | Pending |
| `/previzualizare/email` | `src/app/(romanian)/previzualizare/email/page.tsx` | Pending | Pending | Pending | Pending |
| `/previzualizare` | `src/app/(romanian)/previzualizare/page.tsx` | Pending | Pending | Pending | Pending |
| `/rca-rovinieta` | `src/app/(romanian)/rca-rovinieta/page.tsx` | Pending | Pending | Pending | Pending |
| `/recuperare-parola` | `src/app/(romanian)/recuperare-parola/page.tsx` | Pending | Pending | Pending | Pending |
| `/resetare-parola` | `src/app/(romanian)/resetare-parola/page.tsx` | Pending | Pending | Pending | Pending |
| `/smartdrive-gps` | `src/app/(romanian)/smartdrive-gps/page.tsx` | Pending | Pending | Pending | Pending |
| `/stergere-cont` | `src/app/(romanian)/stergere-cont/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/[[...segments]]` | `src/app/en/[[...segments]]/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/delete-account` | `src/app/en/delete-account/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/forgot-password` | `src/app/en/forgot-password/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/rca-road-vignette` | `src/app/en/rca-road-vignette/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/reset-password` | `src/app/en/reset-password/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/sign-in` | `src/app/en/sign-in/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/sign-up` | `src/app/en/sign-up/page.tsx` | Pending | Pending | Pending | Pending |
| `/en/smartdrive-gps` | `src/app/en/smartdrive-gps/page.tsx` | Pending | Pending | Pending | Pending |

## Dashboard sections (same account route)

| Section | Desktop | Android | Live workflow |
| --- | --- | --- | --- |
| Feedback | Pending visual review | Pending device review | Pending end-to-end |
| Cont | Pending visual review | Pending device review | Pending end-to-end |
| Dashboard | Pending visual review | Pending device review | Pending end-to-end |
| Garaj | Pending visual review | Pending device review | Pending end-to-end |
| AutoCare AI | Pending visual review | Pending device review | Pending end-to-end |
| Documente | Pending visual review | Pending device review | Pending end-to-end |
| RCA & Rovinietă | Pending visual review | Pending device review | Pending end-to-end |
| Istoric auto | Pending visual review | Pending device review | Pending end-to-end |
| Întreținere | Pending visual review | Pending device review | Pending end-to-end |
| Calendar | Pending visual review | Pending device review | Pending end-to-end |
| Plan întreținere | Pending visual review | Pending device review | Pending end-to-end |
| Kilometraj | Pending visual review | Pending device review | Pending end-to-end |
| Cheltuieli | Pending visual review | Pending device review | Pending end-to-end |
| Notificări | Pending visual review | Pending device review | Pending end-to-end |
| Abonament | Pending visual review | Pending device review | Pending end-to-end |
| Centru de suport | Pending visual review | Pending device review | Pending end-to-end |
| Rapoarte | Pending visual review | Pending device review | Pending end-to-end |
| Premium | Pending visual review | Pending device review | Pending end-to-end |
| Setări | Pending visual review | Pending device review | Pending end-to-end |

CSS parse check: 53 stylesheets parsed successfully. Computed palette contrast: main ink/white 15.93:1; muted ink/white 4.74:1; white/Petrol action 8.63:1; white/destructive action 7.66:1. These checks do not replace rendered accessibility validation.
