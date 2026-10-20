CREATE TABLE "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"providerId" text NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "refundedInvoiceId" text;--> statement-breakpoint
CREATE INDEX "email_event_provider" ON "email_events" USING btree ("providerId");