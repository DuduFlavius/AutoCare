-- Additive only: existing questions, answers and timestamps are preserved.
ALTER TABLE autocare_ai_turns ADD COLUMN IF NOT EXISTS "conversationId" text;
--> statement-breakpoint
ALTER TABLE autocare_ai_turns ADD COLUMN IF NOT EXISTS feedback integer CHECK (feedback IN (-1, 1));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS autocare_ai_conversation ON autocare_ai_turns ("userId", "vehicleId", "conversationId", "createdAt");
