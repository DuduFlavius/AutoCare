import { segmentMeters, type GPSFix } from './gps-tracking';

export type Coordinate = { latitude: number; longitude: number };
export type Turn = { type: string; modifier?: string; exit?: number; location: [number, number] };
export type RoadLane = { indications: string[]; valid: boolean };
export type RoadStep = {
  name: string;
  destinations?: string;
  ref?: string;
  distance: number;
  duration: number;
  maneuver: Turn;
  geometry: { coordinates: [number, number][] };
  intersections?: { lanes?: RoadLane[] }[];
};
export type DrivingRoute = { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: RoadStep[] }[] };
type Segment = { start: [number, number]; end: [number, number]; fraction: number; share: number };
const METRES_PER_DEGREE = 111195;
const radians = Math.PI / 180;
const angularDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function indexRoute(route: DrivingRoute) {
  let distanceAfter = 0;
  let durationAfter = 0;
  return route.legs.flatMap(leg => leg.steps).reverse().map(step => {
    let length = 0;
    const entries = step.geometry.coordinates.slice(1).map((end, index) => {
      const start = step.geometry.coordinates[index];
      const segmentLength = segmentMeters({ latitude: start[1], longitude: start[0] }, { latitude: end[1], longitude: end[0] });
      const entry = { start, end, before: length, length: segmentLength };
      length += segmentLength;
      return entry;
    });
    const segments: Segment[] = entries.filter(entry => entry.length > 0).map(entry => ({
      start: entry.start, end: entry.end, fraction: entry.before / length, share: entry.length / length,
    }));
    const indexed = { step, segments, distanceAfter, durationAfter };
    distanceAfter += step.distance;
    durationAfter += step.duration;
    return indexed;
  }).reverse();
}

const routeIndices = new WeakMap<DrivingRoute, ReturnType<typeof indexRoute>>();

export function navigationProgress(route: DrivingRoute, position: Coordinate, fromStep = 0, course?: Pick<GPSFix, 'speed' | 'heading'>) {
  let steps = routeIndices.get(route);
  if (!steps) {
    steps = indexRoute(route);
    routeIndices.set(route, steps);
  }
  const longitudeScale = METRES_PER_DEGREE * Math.cos(position.latitude * radians);
  const heading = (course?.speed ?? 0) >= 2 && course?.heading != null && course.heading >= 0 && course.heading < 360 ? course.heading : null;
  let bestScore = Infinity;
  let nearestGap = Infinity;
  let closest = { gap: Infinity, index: fromStep, segment: -1, segmentKey: undefined as string | undefined, fraction: 0, coordinate: position, bearing: 0 };
  const limit = course ? Math.min(steps.length, fromStep + 6) : steps.length;
  for (let index = fromStep; index < limit; index++) {
    for (const [segment, { start, end, fraction, share }] of steps[index].segments.entries()) {
      const x = (start[0] - position.longitude) * longitudeScale;
      const y = (start[1] - position.latitude) * METRES_PER_DEGREE;
      const dx = (end[0] - start[0]) * longitudeScale;
      const dy = (end[1] - start[1]) * METRES_PER_DEGREE;
      const ratio = clamp(-(x * dx + y * dy) / (dx * dx + dy * dy));
      const gap = Math.hypot(x + ratio * dx, y + ratio * dy);
      nearestGap = Math.min(nearestGap, gap);
      const bearing = (Math.atan2(dx, dy) / radians + 360) % 360;
      const directionPenalty = heading === null ? 0 : Math.min(24, angularDistance(bearing, heading) * .18);
      const score = gap + directionPenalty + (course ? (index - fromStep) * 2 : 0);
      if (score + 3 >= bestScore) continue;
      bestScore = score;
      closest = {
        gap, index, segment, bearing, segmentKey: start.join(',') + ':' + end.join(','), fraction: fraction + ratio * share,
        coordinate: { latitude: start[1] + ratio * (end[1] - start[1]), longitude: start[0] + ratio * (end[0] - start[0]) },
      };
    }
  }
  const current = steps[closest.index];
  const untilTurn = (current?.step.distance ?? 0) * (1 - closest.fraction);
  return {
    ...closest, nearestGap, untilTurn, next: steps[closest.index + 1]?.step, following: steps[closest.index + 2]?.step,
    distance: untilTurn + (current?.distanceAfter ?? 0),
    seconds: (current?.step.duration ?? 0) * (1 - closest.fraction) + (current?.durationAfter ?? 0),
  };
}

export function guidanceFix(fix: GPSFix | null, now: number): fix is GPSFix {
  return !!fix && Number.isFinite(fix.timestamp) && fix.timestamp <= now + 1500 && now - fix.timestamp <= 8000 &&
    Number.isFinite(fix.accuracy) && fix.accuracy > 0 && fix.accuracy <= 50 &&
    Number.isFinite(fix.latitude) && Math.abs(fix.latitude) <= 85 &&
    Number.isFinite(fix.longitude) && Math.abs(fix.longitude) <= 180;
}

export const initialGuidanceObservation = { timestamp: 0, offRouteFixes: 0, offRouteSince: 0, arrivalFixes: 0 };
export function observeGuidance(
  previous: typeof initialGuidanceObservation, fix: GPSFix, match: ReturnType<typeof navigationProgress>, destination: Coordinate,
) {
  if (fix.timestamp <= previous.timestamp) return previous;
  const sameSequence = !fix.breakBefore && fix.timestamp - previous.timestamp <= 6000;
  const offRoute = match.nearestGap > Math.max(55, fix.accuracy * 2);
  const nearEnd = match.distance <= 35 && match.gap <= 25 && fix.accuracy <= 25 && segmentMeters(fix, destination) <= 40;
  return {
    timestamp: fix.timestamp,
    offRouteFixes: offRoute ? (sameSequence ? previous.offRouteFixes : 0) + 1 : 0,
    offRouteSince: offRoute ? (sameSequence && previous.offRouteSince || fix.timestamp) : 0,
    arrivalFixes: nearEnd ? (sameSequence ? previous.arrivalFixes : 0) + 1 : 0,
  };
}

export function rerouteDue(observation: typeof initialGuidanceObservation, now: number, previousAttempt: number, online: boolean, pending: boolean) {
  return online && !pending && observation.offRouteFixes >= 3 &&
    observation.timestamp - observation.offRouteSince >= 3500 && now - previousAttempt >= 30000;
}

/** Adjust the presentation only. Deviation detection and trip recording use the raw fix. */
export function routeDisplayFix<T extends Coordinate & { accuracy: number; speed?: number | null; heading?: number | null }>(
  fix: T, match: ReturnType<typeof navigationProgress>, currentStep: number,
): T {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || fix.accuracy > 25 ||
      (fix.speed ?? 0) < 2 || fix.heading == null || !Number.isFinite(fix.heading) ||
      fix.heading < 0 || fix.heading >= 360 || match.index > currentStep + 1 ||
      match.gap > Math.min(12, fix.accuracy) || angularDistance(match.bearing, fix.heading) > 30) return fix;
  return { ...fix, ...match.coordinate };
}
