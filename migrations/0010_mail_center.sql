CREATE TABLE IF NOT EXISTS communication_preferences (
  "userId" text PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  transactional boolean NOT NULL DEFAULT true,
  promotional boolean NOT NULL DEFAULT false,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mail_campaigns (
  id text PRIMARY KEY,
  "actorId" text REFERENCES app_user(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  template text NOT NULL,
  category text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  "ctaLabel" text NOT NULL,
  "ctaPath" text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mail_campaigns_created ON mail_campaigns ("createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mail_deliveries (
  id text PRIMARY KEY,
  "campaignId" text NOT NULL REFERENCES mail_campaigns(id) ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  "dedupeKey" text NOT NULL UNIQUE,
  "recipientEmail" text,
  status text NOT NULL DEFAULT 'draft',
  error text,
  "providerId" text,
  context jsonb NOT NULL DEFAULT '{}',
  "attemptedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mail_delivery_campaign_status ON mail_deliveries ("campaignId",status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mail_delivery_provider ON mail_deliveries ("providerId");
