import { z } from 'zod';
import type { Coordinate, DrivingRoute } from './road-navigation';
import { AppError } from './service';

export const roadCoordinate = z.object({ latitude: z.number().min(-85).max(85), longitude: z.number().min(-180).max(180) });
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]);
const geometry = z.object({ coordinates: z.array(lngLat).min(2).max(150000) });
const step = z.object({
  name: z.string().max(512), distance: z.number().nonnegative(), duration: z.number().nonnegative(),
  geometry: z.object({ coordinates: z.array(lngLat).min(1).max(150000) }),
  maneuver: z.object({ type: z.string().max(64), modifier: z.string().max(32).optional(), exit: z.number().int().positive().optional(), location: lngLat }),
});
const result = z.object({
  code: z.literal('Ok'),
  routes: z.array(z.object({ distance: z.number().positive(), duration: z.number().positive(), geometry, legs: z.array(z.object({ steps: z.array(step).min(1).max(2500) })).length(1) })).min(1).max(4),
});

export async function loadDrivingRoutes(origin: Coordinate, destination: Coordinate): Promise<DrivingRoute[]> {
  const endpoint = (process.env.AUTOCARE_ROUTING_URL || 'https://routing.openstreetmap.de/routed-car').replace(/\/$/, '');
  const pair = [origin, destination].map(point => [point.longitude.toFixed(5), point.latitude.toFixed(5)].join(',')).join(';');
  const url = new URL(endpoint + '/route/v1/driving/' + pair);
  url.search = new URLSearchParams({ steps: 'true', alternatives: 'true', overview: 'full', geometries: 'geojson', radiuses: '250;250' }).toString();
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
    const payload = await response.json();
    if (payload?.code === 'NoRoute' || payload?.code === 'NoSegment')
      throw new AppError(422, 'Nu există un traseu auto între punctele selectate.');
    if (!response.ok) throw new Error('Routing request failed');
    return result.parse(payload).routes;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'Planificarea traseelor este indisponibilă momentan.');
  }
}
