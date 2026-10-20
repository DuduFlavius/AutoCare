ALTER TABLE "vehicles" ADD CONSTRAINT "vehicle_odometer_nonnegative" CHECK ("odometer">=0);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicle_owner_pair" UNIQUE("id","userId");
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "record_owner_vehicle" FOREIGN KEY ("vehicleId","userId") REFERENCES "vehicles"("id","userId") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "record_kind" CHECK ("kind" IN ('document','service','expense'));
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "record_amount_nonnegative" CHECK ("amountBani">=0);
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "record_owner_pair" UNIQUE("id","userId");
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "file_owner_record" FOREIGN KEY ("recordId","userId") REFERENCES "records"("id","userId") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "file_size_limit" CHECK ("size">0 AND "size"<=2097152);
--> statement-breakpoint
CREATE INDEX "session_owner_idx" ON "session"("userId");
--> statement-breakpoint
CREATE INDEX "record_due_idx" ON "records"("expiresAt") WHERE NOT "cancelled";
--> statement-breakpoint
CREATE INDEX "notification_owner_idx" ON "notifications"("userId");
--> statement-breakpoint
CREATE INDEX "file_owner_idx" ON "files"("userId");
