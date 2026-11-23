CREATE TABLE IF NOT EXISTS mileage_reading_corrections (
  id text PRIMARY KEY,
  "readingId" text NOT NULL REFERENCES mileage_readings(id) ON DELETE CASCADE,
  "previousOdometer" integer NOT NULL,
  "correctedOdometer" integer NOT NULL,
  reason text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
