import { unstable_cache } from 'next/cache';
import { origin } from './config';
import { autoPointQuery, parseAutoPoints, type AutoPointCategory } from './auto-points';

export const loadAutoPoints = unstable_cache(
  async (latitude: number, longitude: number, category: AutoPointCategory) => {
    const europeanArea = latitude >= 35 && latitude <= 70 && longitude >= -12 && longitude <= 35;
    const endpoint = process.env.AUTOCARE_OVERPASS_URL || (europeanArea
      ? 'https://ovp.dresel.systems/api/interpreter'
      : 'https://overpass-api.de/api/interpreter');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': `AutoCare-Premium/1.0 (+${origin()})`,
        Referer: origin() + '/',
      },
      body: new URLSearchParams({ data: autoPointQuery(latitude, longitude, category) }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('OpenStreetMap provider unavailable');
    return parseAutoPoints(await response.json(), category);
  },
  ['autocare-auto-points-v2'],
  { revalidate: 1800 },
);
