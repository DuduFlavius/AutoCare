CREATE TABLE IF NOT EXISTS feedback_items (
 id text PRIMARY KEY, "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 "clientId" text NOT NULL, category text NOT NULL CHECK(category IN ('suggestion','problem','experience')),
 area text NOT NULL DEFAULT 'general' CHECK(area IN ('general','documents','gps','expenses','account','support','ai')),
 rating integer CHECK(rating BETWEEN 1 AND 5), message text NOT NULL CHECK(length(message) BETWEEN 10 AND 5000), fingerprint text NOT NULL,
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','review','progress','resolved','closed')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high','critical')),revision integer NOT NULL DEFAULT 1,
 "createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS feedback_client_dedupe ON feedback_items("userId","clientId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_owner_date ON feedback_items("userId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_queue ON feedback_items(status,priority,"updatedAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback_replies (
 id text PRIMARY KEY,"feedbackId" text NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
 "authorId" text REFERENCES app_user(id) ON DELETE SET NULL,"authorRole" text NOT NULL,message text NOT NULL CHECK(length(message) BETWEEN 2 AND 5000),"clientId" text NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS feedback_reply_dedupe ON feedback_replies("feedbackId","clientId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback_files (
 id text PRIMARY KEY,"feedbackId" text NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,name text NOT NULL,mime text NOT NULL,size integer NOT NULL CHECK(size BETWEEN 1 AND 2097152),data text NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_file_parent ON feedback_files("feedbackId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback_events (
 id text PRIMARY KEY,"feedbackId" text NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,"actorId" text REFERENCES app_user(id) ON DELETE SET NULL,action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',"createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_event_parent ON feedback_events("feedbackId","createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback_preferences (
 "userId" text PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,"dismissedAt" timestamptz,"invitedAt" timestamptz,"submittedAt" timestamptz
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback_notices (
 id text PRIMARY KEY,"userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,"feedbackId" text NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,kind text NOT NULL,"readAt" timestamptz,"pushState" text NOT NULL DEFAULT 'pending',"createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_notice_owner ON feedback_notices("userId","readAt");
