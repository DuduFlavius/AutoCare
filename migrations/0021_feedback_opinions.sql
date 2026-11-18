-- Allow short, natural opinions while retaining the message size limit.
ALTER TABLE feedback_items DROP CONSTRAINT IF EXISTS feedback_items_message_check;
--> statement-breakpoint
ALTER TABLE feedback_items ADD CONSTRAINT feedback_items_message_check CHECK(length(btrim(message)) BETWEEN 2 AND 5000);
