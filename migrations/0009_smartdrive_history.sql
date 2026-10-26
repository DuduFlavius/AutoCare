-- Additive SmartDrive tables. Apply only to an approved preview/staging database first.
CREATE TABLE IF NOT EXISTS mileage_readings (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  "vehicleId" text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  odometer integer NOT NULL CHECK (odometer >= 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'vehicle-edit', 'initial')),
  "recordedAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mileage_readings_owner_vehicle ON mileage_readings("userId", "vehicleId", "recordedAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS gps_trips (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  "vehicleId" text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  "distanceMeters" integer NOT NULL CHECK ("distanceMeters" >= 0),
  "durationSeconds" integer NOT NULL CHECK ("durationSeconds" >= 0),
  "startedAt" timestamptz NOT NULL,
  "endedAt" timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'browser-gps',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps_trip_dates CHECK ("endedAt" >= "startedAt")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS gps_trips_owner_vehicle ON gps_trips("userId", "vehicleId", "startedAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mileage_reminder_preferences (
  "userId" text PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  "frequencyDays" integer NOT NULL DEFAULT 3 CHECK ("frequencyDays" BETWEEN 1 AND 90),
  enabled boolean NOT NULL DEFAULT true,
  "lastSentAt" timestamptz,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
