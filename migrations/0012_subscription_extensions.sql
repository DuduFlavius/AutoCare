CREATE TABLE IF NOT EXISTS subscription_extensions (
 id text PRIMARY KEY,
 "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 "sessionId" text NOT NULL UNIQUE,
 "paymentIntent" text,
 months integer NOT NULL,
 "amountBani" integer NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 "startsAt" timestamptz,
 "endsAt" timestamptz,
 "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS subscription_extension_owner ON subscription_extensions("userId");

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS subscription_extension_pending ON subscription_extensions("userId") WHERE status IN ('pending','processing');
