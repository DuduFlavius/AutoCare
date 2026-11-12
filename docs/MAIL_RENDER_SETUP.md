# AutoCare mail activation on Render

The application uses the existing Gmail OAuth delivery pipeline for Mail Center, with per-recipient logs, consent checks, deduplication, retries and an explicit tested/approved automation gate. Do not interpret a queued/held email as delivered.

## Server configuration

Set these in Render Environment without placing secrets in source or frontend:

- GOOGLE_MAIL_CLIENT_ID: OAuth Web application client ID from the existing Google Cloud project.
- GOOGLE_MAIL_CLIENT_SECRET: the matching client secret.
- GOOGLE_MAIL_FROM: the Gmail sender authorized through OAuth. The current integration validates an @gmail.com address.
- GOOGLE_MAIL_REDIRECT_URI: https://autocare-jglt.onrender.com/api/v1/mail/google/callback
- AUTOCARE_MAIL_AUTOMATIONS_ENABLED=true: deployment gate only; provider test and Founder approval are still required.

The same redirect URI must be registered in the Google Cloud OAuth client. Reconnect Gmail from Founder → Administrative settings → Gmail, then use the real test-email action and verify the provider result. The hosting migration changed the authentication encryption secret, so an old encrypted Gmail connection may require reconnection. Do not copy encrypted Vercel variable payloads as credentials; sensitive Vercel values are write-only.

Founder identity must be the existing verified administrative account ID in AUTOCARE_FOUNDER_USER_ID, never the first user, an email guessed from another service, or a client-editable profile field.

## Scheduled delivery

The prepared .github/workflows/reminders.yml calls the authenticated job hourly. GitHub schedules execute from the repository default branch. Configure repository variable AUTOCARE_APP_URL=https://autocare-jglt.onrender.com and repository secret CRON_SECRET matching Render; ensure the workflow and scripts/trigger-reminders.mjs are present on the default branch. This integration does not have a GitHub repository-secrets write tool, and Render does not expose the existing secret for retrieval. Do not claim the hourly schedule is active until configured and a run succeeds. Render Free sleeping does not provide a reliable in-process substitute for an external scheduler.

## Activation checks

1. Founder access resolves to the original account.
2. Gmail configuration status reports complete; missing variable names are shown without values.
3. OAuth callback succeeds on the Render origin; refresh authorization is valid.
4. Real test email returns a provider message ID; check Inbox/Spam.
5. Founder approves automation after the test. Marketing/news remain subject to consent and release publishing rules.
6. Verify an authenticated scheduled-job run and delivery logs.

Manual Premium grants now create one deduplicated held notification in the same transaction as the grant, without issuing a Stripe charge or invoice. Default templates follow each recipient's saved language; preview language can be chosen independently by the administrator.
