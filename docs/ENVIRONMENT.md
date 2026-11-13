# Variabile de mediu

Niciun fișier `.env*` nu este inclus. Creează configurația numai local sau în serviciul de găzduire. Valorile existente de producție nu au fost citite sau exportate în această recuperare.

- `DATABASE_URL`
- `LOCAL_DATABASE_PATH`
- `APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- `BETTER_AUTH_SECRET`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `CRON_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_ANNUAL_PRICE_ID`
- `NEXT_PUBLIC_MONTHLY_PRICE`
- `NEXT_PUBLIC_ANNUAL_PRICE`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `BACKUP_KEY`
- `AUTOCARE_FOUNDER_USER_ID`
- `AUTOCARE_ENABLE_LIVE_PAYMENTS`
- `AUTOCARE_REQUIRE_EMAIL_VERIFICATION`

`DATABASE_URL` este exclusiv pe server; nu folosi prefixul NEXT_PUBLIC_ pentru secrete. `LOCAL_DATABASE_PATH` este pentru dezvoltare izolată, nu pentru producție. Rolul de Fondator este asociat configurării serverului; nu există un cont implicit în surse.

`AUTOCARE_OVERPASS_URL` este opțional. AutoCare Maps folosește implicit interpretul Overpass public OpenStreetMap. Pentru o instanță dedicată, configurează URL-ul HTTPS complet al interpretorului. Cererile sunt explicite, folosesc centrul aproximativ al hărții și au limitare pe cont și cache comun de 30 de minute.

## Optional public measurement (audit 13.11.2026)

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: real GA4 web stream ID (`G-...`). No script is loaded without a valid ID and explicit audience-measurement consent. Rebuild after changing a NEXT_PUBLIC value. Disable form/enhanced user-data measurement in GA4 before validation.
- `BING_SITE_VERIFICATION`: the real 32-character hexadecimal `msvalidate.01` token supplied by Bing Webmaster Tools.
- No placeholder values are supplied. Google ownership continues to use the existing Founder configuration / `GOOGLE_SITE_VERIFICATION`.
- Audit and remaining external checks: `docs/audit/SEO_ASO_STRATEGY_2026_11_13.md`.
