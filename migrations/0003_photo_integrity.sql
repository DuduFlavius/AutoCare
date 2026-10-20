ALTER TABLE "vehicle_photos" ADD CONSTRAINT "photo_owner_vehicle" FOREIGN KEY ("vehicleId","userId") REFERENCES "vehicles"("id","userId") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "photo_size" CHECK ("size">0 AND "size"<=2097152);
