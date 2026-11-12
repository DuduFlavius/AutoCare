# Data Safety evidence inventory — not a submitted declaration

Owner must validate the final release, processors and retention; do not answer “no data collected.” A service-provider exception to sharing is not automatic and must be assessed under Google rules.

| Data | Current feature/purpose | Review for final declaration |
| --- | --- | --- |
| Name, email, account identifier | Login, ownership, support, transactional communication | Personal information / user IDs; account deletion and retention |
| Vehicle details, plate, mileage, maintenance | Garage and vehicle records | Personal/user-provided information; identifiers and service history |
| Expenses and purchase/subscription history | Financial module and billing | Financial information / purchase history; Stripe processing |
| Invoice/document attachments | User-requested storage and document review | Files/documents and any personal data contained in them |
| GPS coordinates/routes/duration | Opt-in SmartDrive and native AutoDrive | Precise location, including background behavior; optional feature permissions |
| Bluetooth vehicle identifier | Opt-in native vehicle detection | Device/other identifiers; distinguish locally stored values from transmitted data |
| AI questions/history and relevant vehicle context | Premium user-requested assistant | User content and provider processing; review actual Gemini terms and retention |
| Support conversations | Customer support | Messages/user content and access controls |
| Notification subscriptions/delivery logs | Opt-in reminders, security and operations | Device identifiers where collected; email/push processors |
| Operational logs | Abuse prevention and troubleshooting | Audit actual IP/device/log fields and processor retention |

Existing protection includes HTTPS server origins, authenticated owner-scoped APIs and server-side provider secrets. This does not establish at-rest encryption or a universal retention policy; validate processor settings rather than claiming them.

Before submission: review all SDKs, specify optional/required collection and purposes, verify privacy/deletion flows and links, document legally required billing retention, test deletion, and complete the Play Console form. The final IARC questionnaire must reflect actual content and AI behavior. Do not invent a content rating.
