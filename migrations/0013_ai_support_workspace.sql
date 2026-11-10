CREATE TABLE IF NOT EXISTS autocare_ai_turns (
  id text PRIMARY KEY, "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  "vehicleId" text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  question text NOT NULL, answer text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS autocare_ai_owner_vehicle ON autocare_ai_turns ("userId", "vehicleId", "createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS support_thread_operations (
  "threadId" text PRIMARY KEY REFERENCES support_threads(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent')),
  workflow text NOT NULL DEFAULT 'working' CHECK (workflow IN ('working','waiting')),
  rating integer CHECK (rating BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS support_internal_notes (
  id text PRIMARY KEY, "threadId" text NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  "authorId" text REFERENCES app_user(id) ON DELETE SET NULL, body text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS support_notes_thread_time ON support_internal_notes ("threadId", "createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS support_typing (
  "threadId" text NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  "updatedAt" timestamptz NOT NULL DEFAULT now(), "typingAt" timestamptz, PRIMARY KEY ("threadId", "userId")
);
