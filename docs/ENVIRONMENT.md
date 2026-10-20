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
