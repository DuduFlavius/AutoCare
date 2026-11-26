import type { Turn } from './road-navigation';

export type DriveManeuver = 'straight' | 'turn' | 'slight' | 'sharp' | 'uturn' | 'fork' | 'merge' | 'ramp-on' | 'ramp-off' | 'roundabout' | 'lane' | 'arrive' | 'unknown';
const roundabouts = ['roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary'];
const directional = new Set(['right','left','slight right','slight left','sharp right','sharp left']);
const basicTurns = new Set(['turn','continue','new name','end of road']);

export function driveManeuver(turn?: Pick<Turn, 'type' | 'modifier' | 'exit'>) {
  const modifier = turn?.modifier;
  const type = turn?.type;
  const side = modifier && directional.has(modifier) ? modifier.endsWith('left') ? 'left' : 'right' : undefined;
  let kind: DriveManeuver = 'unknown';
  if (type === 'arrive') kind = 'arrive';
  else if (type && roundabouts.includes(type)) kind = 'roundabout';
  else if (type === 'on ramp') kind = 'ramp-on';
  else if (type === 'off ramp') kind = 'ramp-off';
  else if (type === 'use lane') kind = 'lane';
  else if (type === 'fork' && side) kind = 'fork';
  else if (type === 'merge' && side) kind = 'merge';
  else if (type === 'depart') kind = 'straight';
  else if (type && basicTurns.has(type)) {
    if (modifier === 'uturn') kind = 'uturn';
    else if (modifier === 'straight') kind = 'straight';
    else if (side && modifier?.startsWith('slight')) kind = 'slight';
    else if (side && modifier?.startsWith('sharp')) kind = 'sharp';
    else if (side) kind = 'turn';
  }
  const exit=kind==='roundabout' && typeof turn?.exit==='number' && Number.isInteger(turn.exit) && turn.exit>0 ? turn.exit : undefined;
  return {kind,left:side==='left',side,exit};
}

export function describeDriveManeuver(turn: Turn, english: boolean): string {
  const { kind, side, exit } = driveManeuver(turn);
  const ro = side === 'left' ? 'stânga' : 'dreapta';
  switch (kind) {
    case 'arrive': return english ? 'Arrive at your destination' : 'Ai ajuns la destinație';
    case 'roundabout': return exit ? (english ? `At the roundabout, take exit ${exit}` : `La sensul giratoriu, ia ieșirea ${exit}`)
      : (english ? 'Follow the roundabout' : 'Urmează sensul giratoriu');
    case 'uturn': return english ? 'Make a U-turn' : 'Întoarce';
    case 'merge': return english ? 'Merge into traffic' : 'Încadrează-te în trafic';
    case 'fork': return english ? `Keep ${side}` : `Ține ${ro}`;
    case 'ramp-on': return side?(english?`Take the ramp, ${side}`:`Intră pe bretea, spre ${ro}`):(english?'Take the ramp':'Intră pe bretea');
    case 'ramp-off': return side?(english?`Take the exit, ${side}`:`Ia ieșirea spre ${ro}`):(english?'Take the exit':'Ia ieșirea');
    case 'slight': return english ? `Bear ${side}` : `Virează ușor la ${ro}`;
    case 'sharp': return english ? `Turn sharply ${side}` : `Virează strâns la ${ro}`;
    case 'turn': return english ? `Turn ${side}` : `Virează la ${ro}`;
    case 'lane': return english ? 'Follow the lane guidance' : 'Urmează indicațiile de bandă';
    case 'straight': return english ? 'Continue straight' : 'Continuă înainte';
    default: return english ? 'Follow the marked route' : 'Urmează traseul indicat';
  }
}
