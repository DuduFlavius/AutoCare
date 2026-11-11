import type { GPSFix } from './gps-tracking';
export type GPSSignal = 'off' | 'requesting' | 'searching' | 'connected' | 'weak' | 'stale' | 'error';
/** Display only recent, physically valid telemetry; distance uses its stricter independent filter. */
export function gpsTelemetry(position: GPSFix | null, now: number) {
  const fresh = !!position && [position.latitude, position.longitude, position.accuracy, position.timestamp].every(Number.isFinite)
    && Math.abs(position.latitude) <= 90 && Math.abs(position.longitude) <= 180 && position.accuracy >= 0
    && position.timestamp <= now + 5000 && now - position.timestamp <= 25000;
  return {
    accuracy: fresh ? position.accuracy : null,
    speed: fresh && position.accuracy <= 50 && position.speed != null && Number.isFinite(position.speed) && position.speed >= 0 && position.speed <= 55
      ? Math.round(position.speed * 3.6) : null,
    fresh,
  };
}
export function gpsSignal({ position, now, requested, failed, denied }: { position: GPSFix | null; now: number; requested: boolean; failed: boolean; denied?: boolean }): GPSSignal {
  if (denied) return 'error';
  const telemetry = gpsTelemetry(position, now);
  if (telemetry.fresh) return telemetry.accuracy! > 50 ? 'weak' : 'connected';
  if (failed) return 'error';
  if (position) return 'stale';
  return requested ? 'searching' : 'off';
}
