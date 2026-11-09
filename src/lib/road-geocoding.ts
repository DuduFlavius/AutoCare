import { z } from 'zod';
import { AppError } from './service';
import { origin } from './config';

const field = z.string().max(250).optional();
const feature = z.object({
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]),
  }),
  properties: z.object({ name: field, street: field, housenumber: field, city: field, town: field, village: field, county: field, state: field, country: field }),
});
const result = z.object({ features: z.array(z.unknown()).max(30) });

export async function findRoadDestinations(query: string, latitude: number, longitude: number) {
  const endpoint = process.env.AUTOCARE_GEOCODER_URL || 'https://photon.komoot.io/api/';
  try {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      q: query, limit: '6', lat: latitude.toFixed(1), lon: longitude.toFixed(1),
    }).toString();
    const response = await fetch(url, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(9000),
      headers: { Accept: 'application/json', 'User-Agent': `AutoCare-Premium/1.0 (+${origin()})` },
    });
    if (!response.ok) throw new Error('Geocoder unavailable');
    const { features } = result.parse(await response.json());
    return features.flatMap(value => {
      const parsed = feature.safeParse(value);
      if (!parsed.success) return [];
      const { geometry: { coordinates: [longitude, latitude] }, properties: p } = parsed.data;
      const street = [p.street, p.housenumber].filter(Boolean).join(' ');
      const name = p.housenumber && street ? street : p.name || street || p.city || p.town || p.village;
      if (!name) return [];
      const details = [...new Set([street, p.city || p.town || p.village || p.county, p.state, p.country].filter(Boolean))].filter(value => value !== name).join(', ');
      return [{ latitude, longitude, name, details }];
    }).slice(0, 6);
  } catch {
    throw new AppError(503, 'Căutarea adreselor este indisponibilă momentan. Poți selecta destinația pe hartă.');
  }
}
