CREATE TABLE IF NOT EXISTS support_threads (
 id text PRIMARY KEY, "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 title text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','trashed')),
 "completedAt" timestamptz, "trashedAt" timestamptz, "updatedAt" timestamptz NOT NULL DEFAULT now(), "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS support_thread_owner ON support_threads("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS support_thread_status ON support_threads(status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS support_chat_messages (
 id text PRIMARY KEY, "threadId" text NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
 "authorId" text REFERENCES app_user(id) ON DELETE SET NULL, "authorName" text NOT NULL,
 "authorRole" text NOT NULL CHECK("authorRole" IN ('user','assistant','admin','founder','system')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS support_message_thread ON support_chat_messages("threadId","createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS support_participants (
 "threadId" text NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
 "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 "joinedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS support_participant_unique ON support_participants("threadId","userId");
--> statement-breakpoint
INSERT INTO support_threads(id,"userId",title,status,"completedAt","updatedAt","createdAt")
 SELECT id,"userId",left(message,80),CASE WHEN status='closed' THEN 'completed' ELSE 'open' END,
 CASE WHEN status='closed' THEN "createdAt" ELSE NULL END,"createdAt","createdAt" FROM support
 ON CONFLICT(id) DO NOTHING;
--> statement-breakpoint
INSERT INTO support_chat_messages(id,"threadId","authorId","authorName","authorRole",body,"createdAt")
 SELECT 'legacy-' || x.id,x.id,x."userId",u.name,'user',x.message,x."createdAt" FROM support x JOIN app_user u ON u.id=x."userId" WHERE NOT EXISTS (SELECT 1 FROM support_messages m WHERE m."threadId"=x.id)
 ON CONFLICT(id) DO NOTHING;
