import { z } from 'zod';
const single = z
  .object({
    id: z.string().uuid(),
    distanceMeters: z.number().int().min(0).max(2000000),
    durationSeconds: z.number().int().min(1).max(604800),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  })
  .refine((t) => {
    const duration = (Date.parse(t.endedAt) - Date.parse(t.startedAt)) / 1000;
    return (
      duration >= 0 &&
      Math.abs(duration - t.durationSeconds) <= 60 &&
      t.distanceMeters / t.durationSeconds <= 65
    );
  }, 'Durata sau distanța traseului este invalidă.');
export const automaticTripBatch = z
  .object({
    expectedOdometer: z.number().int().min(0).max(99999999),
    syncMileage: z.boolean().default(true),
    trips: z.array(single).min(1).max(200),
  })
  .refine(
    (v) => new Set(v.trips.map((t) => t.id)).size === v.trips.length,
    'Trasee duplicate în același lot.',
  );
