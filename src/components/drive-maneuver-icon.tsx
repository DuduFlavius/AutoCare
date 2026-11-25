import { driveManeuver, type DriveManeuver } from '@/lib/drive-maneuvers';
import type { Turn } from '@/lib/road-navigation';

const paths: Record<DriveManeuver, string> = {
  straight: 'M16 28V4m-7 7 7-7 7 7',
  turn: 'M9 28V18a5 5 0 0 1 5-5h14m-6-6 6 6-6 6',
  slight: 'M11 28v-7a6 6 0 0 1 2-4L25 5m-8 0h8v8',
  sharp: 'M9 28V9a3 3 0 0 1 5-2l12 9m-8 1 8-1-2-8',
  uturn: 'M8 27V13a8 8 0 1 1 16 0v11m-5-6 5 6 5-6',
  fork: 'M16 28V19m0 0 10-12m-7 1 7-1 1 7M16 19 7 8',
  merge: 'M18 28V4m-6 6 6-6 6 6M6 27l12-12',
  roundabout: 'M12 28v-5a8 8 0 1 1 12-5l5-5m-5 0h5v5',
  arrive: 'M8 28V5m0 2c7-7 10 4 19-1v13c-9 5-12-6-19 1',
};

export function DriveManeuverIcon({ turn, size = 42 }: {
  turn?: Pick<Turn, 'type' | 'modifier' | 'exit'>;
  size?: number;
}) {
  const { kind, left } = driveManeuver(turn);
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none">
    <path d={paths[kind]} transform={left ? 'translate(32 0) scale(-1 1)' : undefined}
      stroke="currentColor" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
