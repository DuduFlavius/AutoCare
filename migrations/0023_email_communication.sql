ALTER TABLE communication_preferences ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE mail_campaigns ADD COLUMN IF NOT EXISTS "scheduledAt" timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mail_campaigns_schedule ON mail_campaigns (status, "scheduledAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mail_consents (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL,
  source text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mail_consents_user ON mail_consents ("userId", "createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mail_suppressions (
  "addressHash" text PRIMARY KEY,
  reason text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
