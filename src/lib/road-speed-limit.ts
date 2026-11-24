import type { GPSFix } from './gps-tracking';
import type { Coordinate } from './road-navigation';

export type SpeedRoad = { id?:number; nodes?:number[]; tags: Record<string, string>; geometry: {lat:number;lon:number}[] };
export const speedRoadRadius = 160;

export function localOffset(origin: Coordinate, lat: number, lon: number) {
  return [(lon-origin.longitude)*111320*Math.cos(origin.latitude*Math.PI/180),(lat-origin.latitude)*111320] as const;
}

function numericLimit(value?: string) {
  const parsed = value?.trim().match(/^(\d{1,3})(?:\s*(km\/h|mph))?$/i);
  if (!parsed) return null;
  const kmh = Math.round(Number(parsed[1]) * (parsed[2]?.toLowerCase() === 'mph' ? 1.609344 : 1));
  return kmh > 0 && kmh <= 200 ? kmh : null;
}

function limitFor(tags: SpeedRoad['tags'], forward: boolean | null) {
  if (Object.keys(tags).some(key => key.startsWith('maxspeed:') && /conditional|variable|lanes/.test(key))) return null;
  const generic = tags['maxspeed:motorcar'] ?? tags.maxspeed;
  const a = numericLimit(tags['maxspeed:motorcar:forward'] ?? tags['maxspeed:forward'] ?? generic);
  const b = numericLimit(tags['maxspeed:motorcar:backward'] ?? tags['maxspeed:backward'] ?? generic);
  return forward === null ? a === b ? a : null : forward ? a : b;
}

export function matchRoadSpeed(fix: GPSFix, roads: SpeedRoad[]) {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 18) return null;
  const heading = fix.heading != null && Number.isFinite(fix.heading) && fix.heading >= 0 && (fix.speed ?? 0) >= 2 ? fix.heading : null;
  const candidates: {distance:number;limit:number|null}[] = [];
  for (const {tags,geometry} of roads) {
    for (let i=1;i<geometry.length;i++) {
      const [x,y]=localOffset(fix,geometry[i-1].lat,geometry[i-1].lon);
      const [endX,endY]=localOffset(fix,geometry[i].lat,geometry[i].lon);
      const dx=endX-x,dy=endY-y,length=Math.hypot(dx,dy);
      if (!length) continue;
      const along=Math.max(0,Math.min(1,-(x*dx+y*dy)/(length*length)));
      const distance=Math.hypot(x+dx*along,y+dy*along);
      if (distance > 22) continue;
      const alignment=heading===null ? null : Math.cos(Math.atan2(dx,dy)-heading*Math.PI/180);
      if (alignment!==null && Math.abs(alignment)<0.65) continue;
      const oneWay=tags['oneway:motorcar'] ?? tags.oneway ?? (tags.junction==='roundabout'?'yes':undefined);
      const forward=alignment===null ? oneWay==='-1'?false:oneWay==='yes'||oneWay==='1'?true:null : alignment>0;
      if ((forward===false && (oneWay==='yes'||oneWay==='1')) || (forward===true && oneWay==='-1')) continue;
      candidates.push({distance,limit:limitFor(tags,forward)});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  const best=candidates[0];
  if (!best || best.distance>12 || candidates.some(candidate=>candidate.distance-best.distance<=Math.max(5,fix.accuracy) && candidate.limit!==best.limit)) return null;
  return best.limit;
}

export function speedWarning(previous: {limit:number|null; first:number|null; active:boolean}, limit:number|null, speed:number|null, time:number) {
  if (limit===null || speed===null || speed<=limit-2) return {limit,first:null,active:false};
  if (previous.limit===limit && previous.active) return previous;
  if (speed<limit+3) return {limit,first:null,active:false};
  const first=(previous.limit===limit?previous.first:null) ?? time;
  return {limit,first,active:time-first>=1500};
}
