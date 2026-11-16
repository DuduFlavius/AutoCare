ALTER TABLE mileage_readings ADD COLUMN IF NOT EXISTS notes text;
--> statement-breakpoint
ALTER TABLE mileage_readings DROP CONSTRAINT IF EXISTS mileage_readings_source_check;
--> statement-breakpoint
ALTER TABLE mileage_readings ADD CONSTRAINT mileage_readings_source_check CHECK (source IN ('manual', 'vehicle-edit', 'initial', 'gps'));
