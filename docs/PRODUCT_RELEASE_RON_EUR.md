# AutoCare product release — 11 November 2026

## Delivered first: cockpit

Published separately before the remaining changes. Structure follows the supplied reference with the original Midnight Titanium palette: six real-data summaries, spending chart, selected garage vehicle, recent activity, important documents, actionable recommendations with appointments, and compact AI access. No income series, fabricated growth percentages, vehicle photographs, or mechanical health claims. Existing financial helpers and recorded data remain authoritative.

## Shared product system

`src/app/product-system.css` defines shared spacing, typography, panels, table headers, filters, controls, mobile inputs, focus states, and reduced-motion behavior. It applies to Garage, vehicle profile, maintenance, calendar, finance, reports, history, documents, notifications, Premium, subscriptions, settings, support, account, public pages and Founder UI without replacing their domain logic. Garage cards now include vector vehicle symbols and document shortcuts. Vehicle photos remain stored and downloadable; visual vehicle identities are vectors. Registration and public product illustrations use vectors as well.

RO/EN switching is available in the sidebar and mobile/desktop header. Language no longer silently changes the preferred financial display currency. Subscription currency has a separate persisted preference and URL parameter.

## Commercial catalog

| Plan | RON | EUR | Renewal |
|---|---:|---:|---|
| Monthly | 150 | 30 | 1 month |
| Quarterly | 450 | 90 | 3 months |
| Annual | 1,700 | 340 | 1 year |

These are fixed commercial amounts, not an FX quote. Existing subscriptions retain their Stripe Price ID, currency and recurring interval.

### Server-only Price ID selection

RON continues using `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_QUARTERLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID` and existing configured RON prices.

EUR supports explicit existing identifiers:

- `STRIPE_MONTHLY_EUR_PRICE_ID`
- `STRIPE_QUARTERLY_EUR_PRICE_ID`
- `STRIPE_ANNUAL_EUR_PRICE_ID`

If an explicit EUR ID is absent, the resolver first checks the existing RON price's `currency_options.eur`. It then searches existing active recurring prices under that same Stripe product. It requires exactly one match of amount, currency and recurrence; no prices/products are created or deleted. Ambiguous matches fail closed. The request explicitly sets Checkout currency and locale and disables Adaptive Pricing to preserve the selected fixed amount. Currency and locale are part of the Checkout idempotency key.

The existing legacy `billing_prices` table accepts only RON monthly/annual mappings. Additional verified price mappings are therefore retained in the existing JSON settings table (`billing-additional-catalog`), with an atomic JSONB merge; no destructive or ad hoc schema migration is required. Signed webhook checks recognize those historical mappings. Invoices retain actual currency and actual minor-unit amounts. Extensions preserve the canonical RON entitlement amount while verifying the exact EUR amount and writing the actual invoice currency.

The Founder Pricing page has a read-only six-price catalog audit. It exposes identifiers and amounts only to the existing Founder permission gate, never credentials.

### Activation and real Stripe Test Mode verification

The Stripe plugin connection is confirmed. The session currently exposes no Stripe API operations or provider skills, despite a refreshed tool/skill discovery. The direct Stripe Dashboard route also requires sign-in in the available browser. No separate Stripe Test Mode key is available in the supplied environment. The isolated test suite is not a substitute for a real Stripe Test Mode run. EUR live activation is gated by `AUTOCARE_ENABLE_EUR_PAYMENTS=true`; the default is off, leaving existing RON billing available. Do not enable this flag before the following verification succeeds.

Run:

```sh
STRIPE_TEST_SECRET_KEY=... node --import tsx scripts/verify-stripe-currencies.ts
```

Also supply the six existing Test Mode Price IDs as `STRIPE_TEST_MONTHLY_RON_PRICE_ID`, `STRIPE_TEST_QUARTERLY_RON_PRICE_ID`, `STRIPE_TEST_ANNUAL_RON_PRICE_ID`, and corresponding `_EUR_` keys. The script rejects live keys, verifies each price, creates six unpaid test Checkout sessions, checks their currency/amount, and expires them. It does not submit payment details or make payments. Payment-success/failure/renewal webhook delivery should additionally be exercised against a dedicated test deployment with its Test Mode webhook signing secret and isolated database before live activation.

No secret keys are sent to the frontend. No existing Stripe subscription is updated by switching the new selector.

## Android release preparation

Existing Capacitor Android application (`ro.autocare.garage`) continues loading the same HTTPS backend. Version prepared as 1.3.0 / code 11; keyboard resize and dark native system bars configured. Native GPS services and permissions unchanged. Google Play release is not complete: the local Gradle wrapper cannot download its distribution due to network restrictions, no signed AAB has been produced, signing/Play Console details are not supplied, and physical-device testing remains required.

Google Play digital-subscription billing rules must be satisfied through Play Billing or an applicable enrolled alternative-billing program; Stripe web Checkout alone does not establish Play Store compliance. See official policy: https://support.google.com/googleplay/android-developer/answer/9858738

## Validation evidence

- First cockpit release: 236 automated tests, TypeScript, lint and production build passed.
- Responsive browser review: desktop, 320px and tablet/phone widths; sidebar viewport calculation and mobile header corrected after visual inspection.
- Payment tests cover all six exact price/currency mappings, explicit currency and locale, distinct idempotency keys, multi-currency prices, ambiguous/wrong prices, EUR invoice renewal, webhook idempotence, existing-subscription guard, EUR extension amounts, and unauthenticated access.
- Real provider test runner exits with a clear missing `STRIPE_TEST_SECRET_KEY` error; no successful real delivery/payment is claimed.
- Full suite: 243 tests passed before the final additional locale-idempotency regression test; the focused billing suite was rerun after that change. TypeScript, lint and production build passed.
- Browser responsive audit: all 16 user-facing modules loaded at desktop, tablet (768px shell), and phone (390px shell) widths — 48 checks with document scroll width equal to viewport width. Additional 320px dashboard check passed. RO/EN switching was exercised from both sidebar and mobile header; EUR prices and signup currency links were checked in both languages.
- Founder private data and real-device/real-provider tests remain outside the available authenticated preview; no unsupported success is claimed.

## Follow-up — 12 November 2026

### Implemented in source

- Shared billing display preference across the landing page, public plan cards, Premium offer and subscription selector. English first visits default to EUR; Romanian first visits default to RON. Explicit URL or saved currency selections win over language defaults and remain intact through Checkout.
- Removed independent hardcoded RON offers from the landing page and Premium banner. Prices remain exactly 150/450/1700 RON and 30/90/340 EUR.
- Shared workspace sizing now reserves 104px above desktop content, 90px above mobile content, and mobile navigation plus safe-area space below all modules. Main width respects the responsive sidebar variable. Headers/actions can wrap, and tables keep overflow inside their own container. The existing AI message-only scroll remains intact.
- This source includes the previous unpromoted greeting and AI composer fixes from upstream f6825c4. None of these newer changes is claimed live.

### Real Stripe catalog verified read-only

Connected account: AutoCare (`acct_1UOFuVD0ZFBnbhyw`), live mode only. All six prices are active, per-unit recurring licensed prices; matching RON/EUR plans share their corresponding product.

| Interval | RON Price ID | EUR Price ID |
| --- | --- | --- |
| Monthly | price_1UVTrlD0ZFBnbhywZjS0qSe2 | price_1Uaaf2D0ZFBnbhywkjAhzhmr |
| Three months | price_1UVTs4D0ZFBnbhywrNvfMenQ | price_1UaaeOD0ZFBnbhywDLAVFXze |
| Annual | price_1UVTscD0ZFBnbhywXHCfqhqG | price_1UaaduD0ZFBnbhywCuOWKeET |

No prices, subscriptions, customers or payments were changed in Stripe. Test Mode access is not included in the connected account: a read request with livemode=false was rejected. Therefore no actual Stripe Test Mode Checkout or provider webhook test is claimed. The test-only verification script remains ready for the account's test credentials and six Test Mode IDs.

### External blockers — publication NOT completed

Vercel reports HTTP 402 `resource_creation_blocked`: the roomlyy team has an overdue balance and needs a valid payment method/reactivation. Both the public domain and preview render `Deployment Paused`. The attempted EUR environment-variable configuration was rejected; those variables have NOT been activated. No Vercel CLI with independent credentials is available in this environment.

After Vercel reactivation and successful real Test Mode validation, configure the three `STRIPE_*_EUR_PRICE_ID` variables using the verified IDs above, set `AUTOCARE_ENABLE_EUR_PAYMENTS=true`, deploy this branch, and promote the verified production deployment to the existing public alias. The explicit EUR safety gate is preserved until validation. Existing RON subscriptions are unchanged.

The managed local browser preview launcher also failed before startup because it passes Vite-only --host/--strictPort options to Next.js. The working application dev command was not rewritten to compensate for preview infrastructure. New browser screenshots/device tests remain unverified.

Validation for this follow-up: 246 automated tests passed, including two new currency preference regressions; TypeScript and lint passed. The final production build passed (Next.js compilation, TypeScript and page generation). Browser checks and actual Android device checks are not claimed.
