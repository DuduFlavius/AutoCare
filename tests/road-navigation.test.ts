import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationProgress, type DrivingRoute, type RoadStep } from '../src/lib/road-navigation';
import { parseAutoPoints } from '../src/lib/auto-points';

const step = (start: [number, number], end: [number, number], type: string): RoadStep => ({
  name: type, distance: 1000, duration: 100, geometry: { coordinates: [start, end] },
  maneuver: { type, location: start },
});
const route: DrivingRoute = {
  distance: 2000, duration: 200, geometry: { coordinates: [[21, 45], [21.02, 45], [21.02, 45.01]] },
  legs: [{ steps: [step([21, 45], [21.02, 45], 'depart'), step([21.02, 45], [21.02, 45.01], 'turn')] }],
};

test('navigation projects onto the road, estimates remaining travel and finds the upcoming turn', () => {
  const progress = navigationProgress(route, { longitude: 21.01, latitude: 45 });
  assert.equal(progress.index, 0);
  assert.equal(progress.next?.maneuver.type, 'turn');
  assert.equal(Math.round(progress.untilTurn), 500);
  assert.equal(Math.round(progress.distance), 1500);
  assert.equal(Math.round(progress.seconds), 150);
});

test('navigation detects GPS points away from the remaining route and does not return to a passed step', () => {
  assert.ok(navigationProgress(route, { longitude: 21.01, latitude: 45.02 }).gap > 1000);
  assert.equal(navigationProgress(route, { longitude: 21.01, latitude: 45 }, 1).index, 1);
});

test('POI data includes real provider details and rejects unsafe phone links', () => {
  const [valid, invalid] = parseAutoPoints({ elements: [
    { id: 12, type: 'node', lat: 45, lon: 21, tags: { brand: 'Test', 'addr:street': 'Strada Test', 'addr:housenumber': '7', 'addr:city': 'Timișoara', phone: '+40 701 234 567', opening_hours: 'Mo-Fr 09:00-17:00' } },
    { id: 13, type: 'way', center: { lat: 45, lon: 21 }, tags: { phone: 'javascript:1234567' } },
  ] }, 'service');
  assert.equal(valid.address, 'Strada Test 7, Timișoara');
  assert.equal(valid.hours, 'Mo-Fr 09:00-17:00');
  assert.equal(valid.phone, '+40 701 234 567');
  assert.equal(invalid.phone, undefined);
});
