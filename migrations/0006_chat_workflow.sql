ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS "assignedTo" text REFERENCES app_user(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS "workingAt" timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS support_reads (
 "threadId" text NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
 "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE, "lastReadAt" timestamptz NOT NULL DEFAULT now(),
 UNIQUE("threadId","userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS support_chat_files (
 id text PRIMARY KEY, "threadId" text NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
 "messageId" text NOT NULL REFERENCES support_chat_messages(id) ON DELETE CASCADE,
 "authorId" text REFERENCES app_user(id) ON DELETE SET NULL,
 name text NOT NULL,mime text NOT NULL,data text NOT NULL,size integer NOT NULL CHECK(size>0 AND size<=2097152),"createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS support_files_thread ON support_chat_files("threadId");
