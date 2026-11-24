import type {LineLayerSpecification,StyleSpecification} from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import {matchRecordedRoadLink} from './recorded-road-match';
import type {SpeedRoad} from './road-speed-limit';
import { segmentMeters, type GPSFix } from './gps-tracking';
const validTrackFix = (p: GPSFix) =>
  [p.latitude, p.longitude, p.accuracy, p.timestamp].every(Number.isFinite)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180
  && p.accuracy >= 0 && p.accuracy <= 20 && p.timestamp > 0;

function reliableTrackLink(previous: GPSFix, next: GPSFix, matching: boolean) {
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0 || seconds > 8 || next.breakBefore) return false;
  const meters = segmentMeters(previous, next);
  const hasDirections=[previous,next].every(p=>p.speed!=null&&p.speed>=2&&p.heading!=null&&p.heading>=0&&p.heading<360);
  const maxMeters=matching&&hasDirections&&seconds<=4?100:45;
  if (meters < 1 || meters > maxMeters || meters / seconds > 55) return false;
  if(matching)return true;
  const course = Math.atan2(
    (next.longitude - previous.longitude) * Math.cos((next.latitude + previous.latitude) * Math.PI / 360),
    next.latitude - previous.latitude,
  ) * 180 / Math.PI;
  return [previous, next].every(({ speed, heading }) => {
    if (speed != null && (!Number.isFinite(speed) || speed < 0.7 || speed > 55)) return false;
    if (speed == null || speed < 2 || heading == null || !Number.isFinite(heading) || heading < 0 || heading >= 360) return true;
    return Math.abs(((course - heading + 540) % 360) - 180) <= 40;
  });
}

// Native snapshots can recreate the point objects. Cache by measurement and
// immutable road batch so unchanged links are not searched again on each fix.
const matchedLinks=new WeakMap<readonly SpeedRoad[],Map<string,number[][]|null>>();
function cachedMatch(start:GPSFix,end:GPSFix,roads:readonly SpeedRoad[]){
  let links=matchedLinks.get(roads);
  if(!links){links=new Map();matchedLinks.set(roads,links);}
  const key=[start,end].flatMap(p=>[p.timestamp,p.latitude,p.longitude,p.accuracy,p.speed,p.heading]).join(',');
  if(links.has(key))return links.get(key);
  const line=matchRecordedRoadLink(start,end,roads);
  if(links.size>=2400)links.delete(links.keys().next().value!);
  links.set(key,line);
  return line;
}

/** Draw only supported links. Keep the recorded samples and mileage untouched. */
export function routeGeometry(points: GPSFix[], mappedRoads?: readonly SpeedRoad[]): FeatureCollection<LineString> {
  const lines: number[][][] = [];
  let previous: GPSFix | null = null;
  let line: number[][] | null = null;
  let lastTimestamp = 0;
  for (const point of points) {
    if (!validTrackFix(point) || point.timestamp <= lastTimestamp) {
      previous = null;
      line = null;
      continue;
    }
    lastTimestamp = point.timestamp;
    if (previous && reliableTrackLink(previous, point, !!mappedRoads)) {
      if (mappedRoads) {
        const link=cachedMatch(previous,point,mappedRoads);
        if(link) lines.push(link);
      } else {
        if (!line) {
          line = [[previous.longitude, previous.latitude]];
          lines.push(line);
        }
        line.push([point.longitude, point.latitude]);
      }
    } else {
      line = null;
    }
    previous = point;
  }
  return {
    type: 'FeatureCollection',
    features: lines
      .filter((l) => l.length > 1)
      .map((coordinates) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })),
  };
}
export const roadMapStyle = 'https://tiles.openfreemap.org/styles/fiord';

/** Keep OSM's topology, source filters and labels. Rebuild the navigation hierarchy around stroked roads. */
export function streetOnlyStyle(style: StyleSpecification, day = false): StyleSpecification {
  const background=day?'#f3f5f2':'#132329';
  const roadEdge=day?'#becbd1':'#162c38';
  const street=day?'#ffffff':'#405a68';
  const major=day?'#fffbec':'#6f8590';
  const motorway=day?'#f4d69a':'#aa9367';
  const isStreet=(id:string)=>id==='highway_minor'||id==='autocare-local-casing';
  const width=(low:number,mid:number,high:number):LineLayerSpecification['paint']=>({
    'line-width':['interpolate',['linear'],['zoom'],10,low,15,mid,19,high],
  });
  const layers=style.layers.flatMap<StyleSpecification['layers'][number]>(layer=>{
    if(layer.type==='raster'||layer.type==='hillshade'||/^railway.*_dashline$/.test(layer.id)||layer.id==='highway_path')return [];
    if(layer.type==='background')return [{...layer,paint:{...layer.paint,'background-color':background}}];
    if(layer.type==='fill'){
      if(/building/.test(layer.id))return [{...layer,minzoom:15,paint:{...layer.paint,
        'fill-color':day?'#dae2e1':'#26383f','fill-opacity':day?.65:.55}}];
      const color=/water/.test(layer.id)?(day?'#bcdbe7':'#224653'):/park|wood|grass/.test(layer.id)?(day?'#dcead8':'#233d36'):/landuse_residential/.test(layer.id)?(day?'#e9eef0':'#1c2e36'):null;
      return [color?{...layer,paint:{...layer.paint,'fill-color':color}}:layer];
    }
    if(layer.type==='line'&&(/road|highway|^autocare-local-casing$/.test(layer.id))&&!/rail|tunnel|bridge|pier/.test(layer.id)){
      const casing=layer.id.endsWith('casing');
      const express=/motorway|trunk|primary/.test(layer.id);
      const local=isStreet(layer.id);
      const color=casing?(express?(day?'#c3a367':'#4b4434'):roadEdge):express?motorway:local?street:major;
      const w=local?(casing?width(.35,3.8,15):width(.25,2.5,12)):casing?width(1.7,7,26):width(1.1,5.4,23);
      const updated={...layer,layout:{...layer.layout,'line-cap':'round' as const,'line-join':'round' as const},
        paint:{...layer.paint,...w,'line-color':color}};
      if(layer.id==='highway_minor'&&!style.layers.some(l=>l.id==='autocare-local-casing')){
        const outline={...updated,id:'autocare-local-casing',paint:{...updated.paint,...width(.35,3.8,15),'line-color':roadEdge}};
        return [outline,updated];
      }
      return [updated];
    }
    if(layer.type!=='symbol')return [layer];
    const layout={...layer.layout};
    delete layout['icon-image'];
    if(!layout['text-field'])return [];
    if(layer.id.startsWith('highway_name'))layout['text-size']=['interpolate',['linear'],['zoom'],12,10,16,12,19,14];
    return [{...layer,layout,paint:{...layer.paint,
      'text-color':day?'#233d45':'#d8e6e8','text-halo-color':background,'text-halo-width':1.55}}];
  });
  return {...style,layers};
}

export function tripBounds(points: GPSFix[]): [[number, number], [number, number]] {
  const west = Math.min(...points.map(point => point.longitude));
  const south = Math.min(...points.map(point => point.latitude));
  const east = Math.max(...points.map(point => point.longitude));
  const north = Math.max(...points.map(point => point.latitude));
  return [[west, south], [east, north]];
}

export function plannedRouteBounds(coordinates: [number, number][]): [[number, number], [number, number]] {
  const [first] = coordinates;
  const southwest: [number, number] = [...first];
  const northeast: [number, number] = [...first];
  for (const [longitude, latitude] of coordinates) {
    southwest[0] = Math.min(southwest[0], longitude);
    southwest[1] = Math.min(southwest[1], latitude);
    northeast[0] = Math.max(northeast[0], longitude);
    northeast[1] = Math.max(northeast[1], latitude);
  }
  return [southwest, northeast];
}
