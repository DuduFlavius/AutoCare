CREATE TABLE "vehicle_photos" (
	"vehicleId" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"size" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicleId_vehicles_id_fk" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_userId_app_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;