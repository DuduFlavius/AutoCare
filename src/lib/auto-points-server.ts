import { unstable_cache } from 'next/cache';
import { autoPointQuery, parseAutoPoints, type AutoPointCategory } from './auto-points';

export const loadAutoPoints = unstable_cache(
  async (latitude: number, longitude: number, category: AutoPointCategory) => {
    const endpoint = process.env.AUTOCARE_OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ data: autoPointQuery(latitude, longitude, category) }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('OpenStreetMap provider unavailable');
    return parseAutoPoints(await response.json(), category);
  },
  ['autocare-auto-points-v1'],
  { revalidate: 1800 },
);
