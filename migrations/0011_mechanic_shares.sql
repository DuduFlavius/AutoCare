CREATE TABLE IF NOT EXISTS mechanic_shares (
 id text PRIMARY KEY,
 "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 "tokenHash" text NOT NULL UNIQUE,
 snapshot jsonb NOT NULL,
 "fileIds" jsonb NOT NULL,
 "expiresAt" timestamptz NOT NULL,
 revoked boolean NOT NULL DEFAULT false,
 "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mechanic_share_owner ON mechanic_shares("userId");
