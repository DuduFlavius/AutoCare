export type Coordinate = { latitude: number; longitude: number };
export type Turn = { type: string; modifier?: string; exit?: number; location: [number, number] };
export type RoadStep = { name: string; distance: number; duration: number; maneuver: Turn; geometry: { coordinates: [number, number][] } };
export type DrivingRoute = { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: RoadStep[] }[] };

export function navigationProgress(route: DrivingRoute, position: Coordinate, fromStep = 0) {
  const steps = route.legs.flatMap(leg => leg.steps);
  const latitudeScale = 111195;
  const longitudeScale = latitudeScale * Math.cos(position.latitude * Math.PI / 180);
  let closest = { gap: Infinity, index: fromStep, fraction: 0, coordinate: position, bearing: 0 };
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
      return {
        length, ratio, gap: Math.hypot(x + ratio * dx, y + ratio * dy),
        coordinate: {latitude: startLat + ratio * (lat - startLat), longitude: startLon + ratio * (lon - startLon)},
        bearing: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360,
      };
    });
    const total = segments.reduce((sum, segment) => sum + segment.length, 0);
    let traversed = 0;
    for (const segment of segments) {
      // Favor the current road segment when multiple steps overlap.
      if (segment.gap + 3 < closest.gap) closest = {
        gap: segment.gap, index, coordinate: segment.coordinate, bearing: segment.bearing, fraction: total ? (traversed + segment.ratio * segment.length) / total : 0,
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

/** A presentation-only correction. The original fix continues to drive recording and deviation detection. */
export function routeDisplayFix<T extends Coordinate & {accuracy: number; speed?: number | null; heading?: number | null}>(
  fix: T, match: ReturnType<typeof navigationProgress>, currentStep: number,
): T {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || fix.accuracy > 25 ||
      (fix.speed ?? 0) < 2 || fix.heading == null || !Number.isFinite(fix.heading) ||
      fix.heading < 0 || fix.heading >= 360 || match.index > currentStep + 1 ||
      match.gap > Math.min(12, fix.accuracy)) return fix;
  const delta = Math.abs(((match.bearing - fix.heading + 540) % 360) - 180);
  if (delta > 30) return fix;
  return {...fix, ...match.coordinate};
}
