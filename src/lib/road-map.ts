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
export const roadMapStyle = 'https://tiles.openfreemap.org/styles/bright';
