CREATE TABLE "support_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"threadId" text NOT NULL,
	"authorId" text NOT NULL,
	"authorRole" text DEFAULT 'user' NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_threadId_support_id_fk" FOREIGN KEY ("threadId") REFERENCES "public"."support"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_authorId_app_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_thread" ON "support_messages" USING btree ("threadId","createdAt","id");