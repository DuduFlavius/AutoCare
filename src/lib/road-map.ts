import type {StyleSpecification} from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import type { GPSFix } from './gps-tracking';
/** Keep signal gaps disconnected on the map, just as in distance calculations. */
export function routeGeometry(points: GPSFix[]): FeatureCollection<LineString> {
  const lines: number[][][] = [];
  for (const p of points) {
    if (!lines.length || p.breakBefore) lines.push([]);
    lines.at(-1)!.push([p.longitude, p.latitude]);
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

/** Street mode deliberately excludes imagery and terrain shading. */
export function streetOnlyStyle(style:StyleSpecification):StyleSpecification{return {...style,layers:style.layers.filter(layer=>layer.type!=="raster"&&layer.type!=="hillshade")};}

export function tripBounds(points: GPSFix[]): [[number, number], [number, number]] {
  const west = Math.min(...points.map(point => point.longitude));
  const south = Math.min(...points.map(point => point.latitude));
  const east = Math.max(...points.map(point => point.longitude));
  const north = Math.max(...points.map(point => point.latitude));
  return [[west, south], [east, north]];
}
