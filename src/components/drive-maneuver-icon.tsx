import { driveManeuver, type DriveManeuver } from '@/lib/drive-maneuvers';
import type { Turn } from '@/lib/road-navigation';

const paths: Record<DriveManeuver, string> = {
  straight: 'M16 27V5m-6 6 6-6 6 6',
  turn: 'M8 27V17a5 5 0 0 1 5-5h14m-6-6 6 6-6 6',
  slight: 'M10 27v-7a5 5 0 0 1 1.6-3.7L24 5m-7 .5L24 5v7',
  sharp: 'M9 27V8a2 2 0 0 1 3.2-1.6L26 17m-8 1 8-1-1.5-7.5',
  uturn: 'M7 26V13a8 8 0 0 1 16 0v12m-5.5-5.5L23 25l5.5-5.5',
  fork: 'M15 27v-7c0-3 2-4.5 4-6.5L26 7m-7 0h7v7m-11 6c0-3-2-4.5-4-6.5L5 8',
  merge: 'M19 27V5m-5.5 5.5L19 5l5.5 5.5M5 27c0-7 7-9 14-14',
  'ramp-on': 'M16 27v-7c0-4 5-6 5-10V5m-4 4 4-4 4 4M8 26v-5m0-5v-5m0-5V4',
  'ramp-off': 'M16 27v-5c0-4 2-6 5-9l5-5m-6 0h6v6M9 27v-6m0-5v-5m0-5V4',
  roundabout: 'M13 28v-5a8 8 0 1 1 10.6-3.5L28 15m-5 0h5v5',
  lane: 'M7 25V7m18 18V7M16 25v-5m0-5v-4m0-4V5',
  arrive: 'M8 27V6m0 2c6-6 11 3 18-2v13c-7 5-12-4-18 2',
  unknown: 'M6 16h1m8 0h2m8 0h1',
};

export function DriveManeuverIcon({ turn, size = 42 }: {
  turn?: Pick<Turn, 'type' | 'modifier' | 'exit'>;
  size?: number;
}) {
  const {kind,left,side}=driveManeuver(turn);
  const ramp=kind==='ramp-on'||kind==='ramp-off';
  const path=ramp&&!side?'M11 27V10m10 17V10M11 10l5-6 5 6':paths[kind];
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none" data-maneuver={kind}>
    <path d={path} transform={left&&kind!=='roundabout'&&kind!=='arrive'&&kind!=='unknown' ? 'translate(32 0) scale(-1 1)' : undefined}
      stroke="currentColor" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
