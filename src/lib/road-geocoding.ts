import { AppError } from './service';
import {parseRoadDestinations} from './road-provider-data';
import { origin } from './config';


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
    return parseRoadDestinations(await response.json(),latitude,longitude);
  } catch {
    throw new AppError(503, 'Căutarea adreselor este indisponibilă momentan. Poți selecta destinația pe hartă.');
  }
}
