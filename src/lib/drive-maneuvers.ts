import type { Turn } from './road-navigation';

export type DriveManeuver = 'straight' | 'turn' | 'slight' | 'sharp' | 'uturn' | 'fork' | 'merge' | 'roundabout' | 'arrive';
const roundabouts = ['roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary'];

export function driveManeuver(turn?: Pick<Turn, 'type' | 'modifier' | 'exit'>) {
  const modifier = turn?.modifier || 'straight';
  const left = modifier.includes('left');
  const type = turn?.type;
  let kind: DriveManeuver = 'straight';
  if (type === 'arrive') kind = 'arrive';
  else if (type && roundabouts.includes(type)) kind = 'roundabout';
  else if (modifier === 'uturn') kind = 'uturn';
  else if (type === 'merge') kind = 'merge';
  else if ((type === 'fork' || type === 'on ramp' || type === 'off ramp') && modifier !== 'straight') kind = 'fork';
  else if (modifier.startsWith('slight')) kind = 'slight';
  else if (modifier.startsWith('sharp')) kind = 'sharp';
  else if (modifier === 'right' || modifier === 'left') kind = 'turn';
  return { kind, left, exit: kind === 'roundabout' ? turn?.exit : undefined };
}

export function describeDriveManeuver(turn: Turn, english: boolean): string {
  const { kind, left, exit } = driveManeuver(turn);
  const ro = left ? 'stânga' : 'dreapta';
  const en = left ? 'left' : 'right';
  if (kind === 'straight' && turn.type === 'on ramp') return english ? 'Take the ramp' : 'Intră pe bretea';
  if (kind === 'straight' && turn.type === 'off ramp') return english ? 'Take the exit' : 'Ia ieșirea';
  switch (kind) {
    case 'arrive': return english ? 'Arrive at your destination' : 'Ai ajuns la destinație';
    case 'roundabout': return exit ? (english ? `At the roundabout, take exit ${exit}` : `La sensul giratoriu, ia ieșirea ${exit}`)
      : (english ? 'Follow the roundabout' : 'Urmează sensul giratoriu');
    case 'uturn': return english ? 'Make a U-turn' : 'Întoarce';
    case 'merge': return english ? 'Merge into traffic' : 'Încadrează-te în trafic';
    case 'fork':
      if (turn.type === 'on ramp') return english ? `Take the ramp, ${en}` : `Intră pe bretea, spre ${ro}`;
      if (turn.type === 'off ramp') return english ? `Take the exit, ${en}` : `Ia ieșirea spre ${ro}`;
      return english ? `Keep ${en}` : `Ține ${ro}`;
    case 'slight': return english ? `Bear ${en}` : `Virează ușor la ${ro}`;
    case 'sharp': return english ? `Turn sharply ${en}` : `Virează strâns la ${ro}`;
    case 'turn': return english ? `Turn ${en}` : `Virează la ${ro}`;
    default: return english ? 'Continue straight' : 'Continuă înainte';
  }
}
