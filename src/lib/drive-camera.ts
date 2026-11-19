import { segmentMeters, type GPSFix } from './gps-tracking';

export function shortestAngle(from: number, to: number) {
  return ((to - from + 540) % 360 + 360) % 360 - 180;
}

export function driveFrame(previous: GPSFix | null, fix: GPSFix, bearing: number, maneuverDistance?: number) {
  const elapsed = previous ? fix.timestamp - previous.timestamp : 0;
  const continuous = !!previous && elapsed > 0 && elapsed <= 5000 && !fix.breakBefore;
  const movement = continuous ? segmentMeters(previous, fix) : 0;
  const speed = fix.speed ?? (continuous ? movement * 1000 / elapsed : 0);
  const moving = speed >= 1.5;
  const outlier = continuous && movement > elapsed * 0.065 + Math.max(8, previous.accuracy + fix.accuracy);
  let heading = bearing;

  if (!outlier && moving && fix.heading != null && fix.heading >= 0 && fix.heading < 360) {
    heading = fix.heading;
  } else if (!outlier && moving && continuous && movement >= Math.max(7, fix.accuracy * 0.7)) {
    const radians = Math.PI / 180;
    const start = previous.latitude * radians;
    const end = fix.latitude * radians;
    const delta = (fix.longitude - previous.longitude) * radians;
    heading = Math.atan2(Math.sin(delta) * Math.cos(end), Math.cos(start) * Math.sin(end) - Math.sin(start) * Math.cos(end) * Math.cos(delta)) / radians;
  }

  return {
    bearing: bearing + shortestAngle(bearing, heading),
    zoom: 17.5 - Math.min(2, Math.max(0, speed) / 13) + (maneuverDistance != null && maneuverDistance <= 100 ? 0.4 : 0),
    duration: continuous ? Math.min(950, Math.max(180, elapsed * 0.85)) : 0,
    outlier,
    hold: outlier || (continuous && !moving && movement < Math.max(4, fix.accuracy * 0.6)),
  };
}
