CREATE TABLE IF NOT EXISTS "native_push_tokens" (
  "token" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "native_push_user" ON "native_push_tokens" ("user_id");
