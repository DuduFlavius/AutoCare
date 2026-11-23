import { speedRoadRadius, type SpeedRoad } from './road-speed-limit';
import type { Coordinate } from './road-navigation';

const highway = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';
const cache = new Map<string, {expires:number;roads:SpeedRoad[]}>();

export async function loadSpeedRoads({latitude,longitude}:Coordinate, signal:AbortSignal) {
  const key = latitude+','+longitude;
  const cached=cache.get(key);
  if (cached && cached.expires>Date.now()) return cached.roads;
  const endpoint = new URL(process.env.AUTOCARE_SPEED_ROADS_URL || process.env.AUTOCARE_OVERPASS_URL || 'https://ovp.dresel.systems/api/interpreter');
  endpoint.searchParams.set('data',`[out:json][timeout:6];way(around:${speedRoadRadius},${latitude},${longitude})["highway"~"^(${highway})$"];out tags geom;`);
  const response=await fetch(endpoint,{
    headers:{Accept:'application/json','User-Agent':'AutoCare/5.2 (+https://www.autocareapp.ro)'},
    signal:AbortSignal.any([signal,AbortSignal.timeout(8500)]),
    redirect:'error',
    cache:'no-store',
  });
  if (!response.ok) throw Error('Speed road source unavailable');
  const data=await response.json();
  if (data.remark || !Array.isArray(data.elements)) throw Error('Incomplete speed road response');
  const roads:SpeedRoad[]=data.elements.filter((road:SpeedRoad)=>road.tags?.highway && Array.isArray(road.geometry) && road.geometry.length>=2 &&
    road.geometry.every(point=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lon)));
  if (cache.size>=128) cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+300000,roads});
  return roads;
}
