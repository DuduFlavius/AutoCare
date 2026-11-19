import { z } from 'zod';
import { AppError } from './service';
import { segmentMeters } from './gps-tracking';
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
      q: query, limit: '12', lat: latitude.toFixed(2), lon: longitude.toFixed(2),
    }).toString();
    const response = await fetch(url, {
      next: { revalidate: 300 }, redirect: 'error', signal: AbortSignal.timeout(9000),
      headers: { Accept: 'application/json', 'User-Agent': `AutoCare-Premium/1.0 (+${origin()})` },
    });
    if (!response.ok) throw new Error('Geocoder unavailable');
    const { features } = result.parse(await response.json());
    const seen = new Set<string>();
    return features.flatMap(value => {
      const parsed = feature.safeParse(value);
      if (!parsed.success) return [];
      const { geometry: { coordinates: [lon, lat] }, properties: p } = parsed.data;
      const street = [p.street, p.housenumber].filter(Boolean).join(' ');
      const name = p.name || street || p.city || p.town || p.village;
      if (!name) return [];
      const details = [...new Set([street, p.city || p.town || p.village || p.county, p.state, p.country].filter(Boolean))].filter(value => value !== name).join(', ');
      const identity = [name.toLocaleLowerCase(), lat.toFixed(4), lon.toFixed(4)].join(':');
      if (seen.has(identity)) return [];
      seen.add(identity);
      return [{ latitude: lat, longitude: lon, name, details, distanceKm: segmentMeters({ latitude, longitude }, { latitude: lat, longitude: lon }) / 1000 }];
    }).slice(0, 6);
  } catch {
    throw new AppError(503, 'Căutarea adreselor este indisponibilă momentan. Poți selecta destinația pe hartă.');
  }
}
