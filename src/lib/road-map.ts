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

/** Keep street and place labels while hiding basemap icons and railway ties. */
export function streetOnlyStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers
      .filter(layer => layer.type !== 'raster' && layer.type !== 'hillshade' && !/^railway.*_dashline$/.test(layer.id))
      .map(layer => {
        // Retain the provider's road geometry and zoom expressions; only tune its palette.
        if (layer.type === 'background') return { ...layer, paint: { ...layer.paint, 'background-color': '#101d2b' } };
        if (layer.type === 'fill') {
          const color = /water/.test(layer.id) ? '#0b263b' : /building/.test(layer.id) ? '#1a2b3d' : /park|wood|grass/.test(layer.id) ? '#173331' : null;
          if (color) return { ...layer, paint: { ...layer.paint, 'fill-color': color } };
        }
        if (layer.type === 'line' && /road|highway/.test(layer.id) && !/rail|tunnel|bridge|casing/.test(layer.id)) {
          const color = /motorway|trunk|primary/.test(layer.id) ? '#7b93ae' : /secondary|tertiary/.test(layer.id) ? '#526d89' : '#344e68';
          return { ...layer, paint: { ...layer.paint, 'line-color': color } };
        }
        if (layer.type === 'symbol' && layer.layout?.['text-field']) return { ...layer, paint: { ...layer.paint, 'text-color': /place|country/.test(layer.id) ? '#e1edf9' : '#bdcee0', 'text-halo-color': '#102033', 'text-halo-width': 1.3 } };
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
