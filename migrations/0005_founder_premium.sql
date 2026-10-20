CREATE TABLE IF NOT EXISTS premium_grants (
 id text PRIMARY KEY, "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 "grantedBy" text REFERENCES app_user(id) ON DELETE SET NULL, "grantedAt" timestamptz NOT NULL DEFAULT now(),
 "expiresAt" timestamptz, "revokedAt" timestamptz, "revokedBy" text REFERENCES app_user(id) ON DELETE SET NULL,
 note text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS premium_grant_owner ON premium_grants("userId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_restrictions (
 "userId" text PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE, "suspendedAt" timestamptz,
 reason text NOT NULL DEFAULT '', "updatedBy" text REFERENCES app_user(id) ON DELETE SET NULL, "updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS billing_prices (
 id text PRIMARY KEY, interval text NOT NULL CHECK(interval IN ('monthly','annual')),
 "amountBani" integer NOT NULL CHECK("amountBani">0),currency text NOT NULL DEFAULT 'ron' CHECK(currency='ron'),"createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE records ADD COLUMN IF NOT EXISTS "amountKnown" boolean NOT NULL DEFAULT true;

--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT false;
