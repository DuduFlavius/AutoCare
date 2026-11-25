import { z } from 'zod';
import {parseDrivingRoutes} from './road-provider-data';
import type { Coordinate, DrivingRoute } from './road-navigation';
import { AppError } from './service';

export const roadCoordinate = z.object({ latitude: z.number().min(-85).max(85), longitude: z.number().min(-180).max(180) });

export async function loadDrivingRoutes(origin: Coordinate, destination: Coordinate, startAccuracy = 0, signal?:AbortSignal): Promise<DrivingRoute[]> {
  const endpoint = (process.env.AUTOCARE_ROUTING_URL || 'https://routing.openstreetmap.de/routed-car').replace(/\/$/, '');
  const pair = [origin, destination].map(point => [point.longitude.toFixed(5), point.latitude.toFixed(5)].join(',')).join(';');
  const url = new URL(endpoint + '/route/v1/driving/' + pair);
  url.search = new URLSearchParams({ steps: 'true', alternatives: 'true', overview: 'full', geometries: 'geojson', radiuses: `${Math.max(250, Math.ceil(startAccuracy))};250` }).toString();
  try {
    const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json', 'User-Agent': 'AutoCare/9.0 (+https://www.autocareapp.ro)' }, redirect: 'error', signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
    const payload = await response.json();
    if (payload?.code === 'NoRoute' || payload?.code === 'NoSegment')
      throw new AppError(422, 'Nu există un traseu auto între punctele selectate.');
    if (!response.ok) throw new Error('Routing request failed');
    return parseDrivingRoutes(payload);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'Planificarea traseelor este indisponibilă momentan.');
  }
}

export async function loadRoadDestinations(query:string,latitude:number,longitude:number,signal?:AbortSignal){
 const {parseRoadDestinations}=await import('./road-provider-data');
 const url=new URL(process.env.AUTOCARE_GEOCODING_URL || 'https://photon.komoot.io/api/');
 url.search=new URLSearchParams({q:query.trim(),limit:'12',lat:latitude.toFixed(2),lon:longitude.toFixed(2)}).toString();
 try{const response=await fetch(url,{cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':'AutoCare/5.1 (+https://www.autocareapp.ro)'}});if(!response.ok)throw Error('Search provider unavailable');return parseRoadDestinations(await response.json(),latitude,longitude,query);}
 catch{throw new AppError(503,'Căutarea destinațiilor este indisponibilă momentan.');}
}
