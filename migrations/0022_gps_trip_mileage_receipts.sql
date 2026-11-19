ALTER TABLE gps_trips
  ADD COLUMN IF NOT EXISTS "odometerBefore" integer,
  ADD COLUMN IF NOT EXISTS "odometerAfter" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'gps_trips'::regclass AND conname = 'gps_trip_mileage_receipt'
  ) THEN
    ALTER TABLE gps_trips ADD CONSTRAINT gps_trip_mileage_receipt CHECK (
    ("odometerBefore" IS NULL AND "odometerAfter" IS NULL) OR
    ("odometerBefore" IS NOT NULL AND "odometerAfter" IS NOT NULL
      AND "odometerBefore" >= 0 AND "odometerAfter" >= "odometerBefore")
  );
  END IF;
END $$;
