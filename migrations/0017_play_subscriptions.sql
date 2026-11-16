CREATE TABLE IF NOT EXISTS "play_subscriptions" (
  "tokenHash" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "productId" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "active" boolean NOT NULL DEFAULT false,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "play_subscription_owner" ON "play_subscriptions" ("userId");
