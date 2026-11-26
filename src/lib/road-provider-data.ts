import {z} from 'zod';
import {segmentMeters} from './gps-tracking';
import type {DrivingRoute} from './road-navigation';
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]);
const geometry = z.object({ coordinates: z.array(lngLat).min(2).max(150000) });
const step = z.object({
  name: z.string().max(512), destinations: z.string().max(512).optional(), ref: z.string().max(200).optional(), exits: z.string().max(200).optional(), distance: z.number().nonnegative(), duration: z.number().nonnegative(),
  geometry: z.object({ coordinates: z.array(lngLat).min(1).max(150000) }),
  intersections: z.array(z.object({
    lanes: z.array(z.object({ indications: z.array(z.string().max(24)).max(8), valid: z.boolean() })).max(16).optional(),
  })).max(1000).optional(),
  maneuver: z.object({ type: z.string().max(64), modifier: z.string().max(32).optional(), exit: z.number().int().positive().optional(), location: lngLat }),
});
const result = z.object({
  code: z.literal('Ok'),
  routes: z.array(z.object({ distance: z.number().positive(), duration: z.number().positive(), geometry, legs: z.array(z.object({ steps: z.array(step).min(1).max(2500) })).length(1) })).min(1).max(4),
});

export function parseDrivingRoutes(value:unknown):DrivingRoute[]{return result.parse(value).routes;}
export type DestinationCategory = 'address' | 'city' | 'parking' | 'fuel' | 'charging' | 'poi';

function destinationCategory(type?: string, key?: string, value?: string): DestinationCategory {
  if (value === 'parking' || value === 'parking_entrance') return 'parking';
  if (value === 'fuel') return 'fuel';
  if (value === 'charging_station') return 'charging';
  if (['city', 'town', 'village', 'locality', 'hamlet'].includes(type || '')) return 'city';
  if (['amenity', 'shop', 'tourism', 'leisure', 'office', 'historic', 'railway'].includes(key || '')) return 'poi';
  return 'address';
}
const field = z.string().max(250).optional();
const feature = z.object({
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]),
  }),
  properties: z.object({ name: field, type: field, street: field, housenumber: field, city: field, town: field, village: field, county: field, state: field, country: field, osm_key: field, osm_value: field }),
});
const destinationResult = z.object({ features: z.array(z.unknown()).max(30) });

export function parseRoadDestinations(value:unknown,latitude:number,longitude:number,query=''){
    const { features } = destinationResult.parse(value);
    const seen = new Set<string>();
    const houseNumber=query.match(/(?:^|\s)(\d+[a-zA-Z]?)(?=\s|,|$)/)?.[1]?.toLocaleLowerCase();
    const matchesNumber=(number:string|undefined)=>{
      if(!houseNumber||!number)return false;
      if(number.toLocaleLowerCase()===houseNumber)return true;
      const range=number.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      return !!range&&/^\d+$/.test(houseNumber)&&Number(houseNumber)>=Number(range[1])&&Number(houseNumber)<=Number(range[2]);
    };
    return features.flatMap(value => {
      const parsed = feature.safeParse(value);
      if (!parsed.success) return [];
      const { geometry: { coordinates: [lon, lat] }, properties: p } = parsed.data;
      const street = [p.street, p.housenumber].filter(Boolean).join(' ');
      const name = p.name || street || p.city || p.town || p.village;
      if (!name) return [];
      const details = [...new Set([street, p.city || p.town || p.village || p.county, p.state, p.country].filter(Boolean))].filter(value => value !== name).join(', ');
      const identity=p.type==='street'
        ? ['street',name,details].map(part=>part.toLocaleLowerCase()).join(':')
        : [name.toLocaleLowerCase(),lat.toFixed(4),lon.toFixed(4)].join(':');
      if (seen.has(identity)) return [];
      seen.add(identity);
      return [{ latitude: lat, longitude: lon, name, details, category: destinationCategory(p.type, p.osm_key, p.osm_value), distanceKm: segmentMeters({ latitude, longitude }, { latitude: lat, longitude: lon }) / 1000, numberMatch:matchesNumber(p.housenumber) }];
    }).sort((a,b)=>Number(b.numberMatch)-Number(a.numberMatch)).slice(0,6).map(({numberMatch:_numberMatch,...destination})=>destination);
}
