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

If an explicit EUR ID is absent, the resolver first checks the existing RON price's `currency_options.eur`. It then searches existing active recurring prices under that same Stripe product. It requires exactly one match of amount, currency and recurrence; no prices/products are created or deleted. Ambiguous matches fail closed. The request explicitly sets Checkout currency and locale and disables Adaptive Pricing to preserve the selected fixed amount. Currency is part of the Checkout idempotency key.

The existing legacy `billing_prices` table accepts only RON monthly/annual mappings. Additional verified price mappings are therefore retained in the existing JSON settings table (`billing-additional-catalog`), with an atomic JSONB merge; no destructive or ad hoc schema migration is required. Signed webhook checks recognize those historical mappings. Invoices retain actual currency and actual minor-unit amounts. Extensions preserve the canonical RON entitlement amount while verifying the exact EUR amount and writing the actual invoice currency.

The Founder Pricing page has a read-only six-price catalog audit. It exposes identifiers and amounts only to the existing Founder permission gate, never credentials.

### Activation and real Stripe Test Mode verification

The Stripe plugin connection is confirmed. The session currently exposes no Stripe API operations or provider skills, despite a refreshed tool/skill discovery. No separate Stripe Test Mode key is available in the supplied environment. The isolated test suite is not a substitute for a real Stripe Test Mode run. EUR live activation is gated by `AUTOCARE_ENABLE_EUR_PAYMENTS=true`; the default is off, leaving existing RON billing available. Do not enable this flag before the following verification succeeds.

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
- Final suite: 243 tests passed. TypeScript, lint and production build passed.
- Browser responsive audit: all 16 user-facing modules loaded at desktop, tablet (768px shell), and phone (390px shell) widths — 48 checks with document scroll width equal to viewport width. Additional 320px dashboard check passed. RO/EN switching was exercised from both sidebar and mobile header; EUR prices and signup currency links were checked in both languages.
- Founder private data and real-device/real-provider tests remain outside the available authenticated preview; no unsupported success is claimed.
