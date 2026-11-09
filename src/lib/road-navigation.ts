export type Coordinate = { latitude: number; longitude: number };
export type Turn = { type: string; modifier?: string; exit?: number; location: [number, number] };
export type RoadStep = { name: string; distance: number; duration: number; maneuver: Turn; geometry: { coordinates: [number, number][] } };
export type DrivingRoute = { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: RoadStep[] }[] };

export function navigationProgress(route: DrivingRoute, position: Coordinate, fromStep = 0) {
  const steps = route.legs.flatMap(leg => leg.steps);
  const latitudeScale = 111195;
  const longitudeScale = latitudeScale * Math.cos(position.latitude * Math.PI / 180);
  let closest = { gap: Infinity, index: fromStep, fraction: 0 };
  for (let index = fromStep; index < steps.length; index++) {
    const coordinates = steps[index].geometry.coordinates;
    const segments = coordinates.slice(1).map(([lon, lat], i) => {
      const [startLon, startLat] = coordinates[i];
      const x = (startLon - position.longitude) * longitudeScale;
      const y = (startLat - position.latitude) * latitudeScale;
      const dx = (lon - startLon) * longitudeScale;
      const dy = (lat - startLat) * latitudeScale;
      const length = Math.hypot(dx, dy);
      const ratio = length ? Math.min(1, Math.max(0, -(x * dx + y * dy) / length ** 2)) : 0;
      return { length, ratio, gap: Math.hypot(x + ratio * dx, y + ratio * dy) };
    });
    const total = segments.reduce((sum, segment) => sum + segment.length, 0);
    let traversed = 0;
    for (const segment of segments) {
      // Favor the current road segment when multiple steps overlap.
      if (segment.gap + 3 < closest.gap) closest = {
        gap: segment.gap, index, fraction: total ? (traversed + segment.ratio * segment.length) / total : 0,
      };
      traversed += segment.length;
    }
  }
  const current = steps[closest.index];
  const ahead = steps.slice(closest.index + 1);
  const untilTurn = (current?.distance ?? 0) * (1 - closest.fraction);
  return {
    ...closest, untilTurn, next: ahead[0],
    distance: untilTurn + ahead.reduce((sum, step) => sum + step.distance, 0),
    seconds: (current?.duration ?? 0) * (1 - closest.fraction) + ahead.reduce((sum, step) => sum + step.duration, 0),
  };
}
