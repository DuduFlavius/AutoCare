-- Additive SmartDrive tables. Apply only to an approved preview/staging database first.
CREATE TABLE IF NOT EXISTS mileage_readings (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  vehicle_id text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  odometer integer NOT NULL CHECK (odometer >= 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'vehicle-edit', 'initial')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mileage_readings_owner_vehicle ON mileage_readings(user_id, vehicle_id, recorded_at);
CREATE TABLE IF NOT EXISTS gps_trips (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  vehicle_id text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  distance_meters integer NOT NULL CHECK (distance_meters >= 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'browser-gps',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gps_trip_dates CHECK (ended_at >= started_at)
);
CREATE INDEX IF NOT EXISTS gps_trips_owner_vehicle ON gps_trips(user_id, vehicle_id, started_at);
CREATE TABLE IF NOT EXISTS mileage_reminder_preferences (
  user_id text PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  frequency_days integer NOT NULL DEFAULT 3 CHECK (frequency_days BETWEEN 1 AND 90),
  enabled boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
