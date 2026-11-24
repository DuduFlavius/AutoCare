import type {StyleSpecification} from 'maplibre-gl';
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

/** Keep street and place labels while hiding basemap icons and railway ties. */
export function streetOnlyStyle(style: StyleSpecification, day = false): StyleSpecification {
  return {
    ...style,
    layers: style.layers
      .filter(layer => layer.type !== 'raster' && layer.type !== 'hillshade' && !/^railway.*_dashline$/.test(layer.id))
      .map(layer => {
        // Retain the provider's road geometry and zoom expressions; only tune its palette.
        if (layer.type === 'background') return { ...layer, paint: { ...layer.paint, 'background-color': day ? '#eef2f6' : '#151d2b' } };
        if (layer.type === 'fill') {
          const color = /water/.test(layer.id) ? (day ? '#badfed' : '#1d3a54') : /building/.test(layer.id) ? (day ? '#e0e6ed' : '#252f40') : /park|wood|grass/.test(layer.id) ? (day ? '#d4eadf' : '#203d38') : null;
          if (color) return { ...layer, paint: { ...layer.paint, 'fill-color': color } };
        }
        if (layer.type === 'line' && /road|highway/.test(layer.id) && !/rail|tunnel|bridge|casing/.test(layer.id)) {
          const color = /motorway|trunk|primary/.test(layer.id) ? (day ? '#e9b25e' : '#e3bc79') : /secondary|tertiary/.test(layer.id) ? (day ? '#b7c4d6' : '#8298b7') : (day ? '#fdfefe' : '#586a83');
          return { ...layer, paint: { ...layer.paint, 'line-color': color } };
        }
        if (layer.type === 'symbol' && layer.layout?.['text-field']) return { ...layer, paint: { ...layer.paint, 'text-color': /place|country/.test(layer.id) ? (day ? '#152c21' : '#f3f8f5') : (day ? '#3e5549' : '#cad8e9'), 'text-halo-color': day ? '#f9fcf9' : '#151d2b', 'text-halo-width': 1.3 } };
        return layer;
      })
      .flatMap(layer => {
        if (layer.type !== 'symbol' || !layer.layout?.['icon-image']) return [layer];
        if (!layer.layout['text-field']) return [];
        const layout = { ...layer.layout };
        delete layout['icon-image'];
        return [{ ...layer, layout }];
      }),
  };
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
