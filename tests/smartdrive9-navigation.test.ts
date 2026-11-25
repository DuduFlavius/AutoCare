import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { segmentMeters, type GPSFix } from '../src/lib/gps-tracking';
import { guidanceFix, initialGuidanceObservation, navigationProgress, observeGuidance, rerouteDue, routeDisplayFix, type DrivingRoute, type RoadStep } from '../src/lib/road-navigation';
import { parseDrivingRoutes } from '../src/lib/road-provider-data';

const startTime = Date.UTC(2026, 10, 25, 10);
const destination = { latitude: 45, longitude: 21.5 };
function step(start: [number, number], end: [number, number], type: string, distance = 1_000): RoadStep {
  return { name: type, duration: 60, distance, geometry: { coordinates: [start, end] }, maneuver: { type, location: start } };
}
function route(steps: RoadStep[]): DrivingRoute {
  return { legs: [{ steps }], geometry: { coordinates: steps.flatMap(value => value.geometry.coordinates) }, distance: 1000, duration: 60 };
}
function fix(longitude: number, latitude = 45, seconds = 0, extra: Partial<GPSFix> = {}): GPSFix {
  return { longitude, latitude, timestamp: startTime + seconds * 1000, accuracy: 8, speed: 13, heading: 90, ...extra };
}

test('cold start, stale readings, timestamps in the future and low-accuracy fixes never guide a turn', () => {
  assert.equal(guidanceFix(null, startTime), false);
  assert.equal(guidanceFix(fix(21, 45, 0, { accuracy: 51 }), startTime), false);
  assert.equal(guidanceFix(fix(21, 45, -9), startTime), false);
  assert.equal(guidanceFix(fix(21, 45, 3), startTime), false);
  assert.equal(guidanceFix(fix(21, NaN), startTime), false);
  assert.equal(guidanceFix(fix(21), startTime), true);
});

test('route progress stays on the aligned road and does not attach to a parallel road', () => {
  const path = route([
    step([21, 45], [21.01, 45], 'depart'),
    step([21.01, 45.00004], [21, 45.00004], 'turn'),
    step([21, 45.00004], [21, 45.01], 'roundabout'),
  ]);
  const eastbound = fix(21.005, 45.000035);
  const westbound = { ...eastbound, heading: 270 };
  assert.equal(navigationProgress(path, eastbound, 0, eastbound).index, 0);
  assert.equal(navigationProgress(path, westbound, 0, westbound).index, 1);
  const parallel = fix(21.005, 45.00022);
  assert.equal(routeDisplayFix(parallel, navigationProgress(path, parallel, 0, parallel), 0), parallel);
  const stationary = fix(21.005, 45.00003, 1, { speed: 0 });
  assert.equal(routeDisplayFix(stationary, navigationProgress(path, stationary, 0, stationary), 0), stationary);
});

test('provider lane indications and successive turns survive parsing', () => {
  const first = step([21, 45], [21.01, 45], 'depart');
  const roundabout = step([21.01, 45], [21.011, 45.001], 'roundabout', 90);
  roundabout.maneuver.exit = 2;
  roundabout.intersections = [{ lanes: [{ indications: ['left'], valid: false }, { indications: ['straight'], valid: true }] }];
  const end = step([21.011, 45.001], [21.02, 45.001], 'turn');
  const [parsed] = parseDrivingRoutes({ code: 'Ok', routes: [route([first, roundabout, end])] });
  const progress = navigationProgress(parsed, fix(21.005), 0, fix(21.005));
  assert.equal(progress.next?.maneuver.exit, 2);
  assert.equal(progress.next?.intersections?.[0].lanes?.[1].valid, true);
  assert.equal(progress.following?.maneuver.type, 'turn');
});

test('arrival and rerouting need independent fixes, with offline, tunnel and cooldown protection', () => {
  const path = route([step([21, 45], [21.5, 45], 'depart')]);
  let state = initialGuidanceObservation;
  for (const seconds of [0, 2, 4]) {
    const reading = fix(21.2, 45.01, seconds);
    state = observeGuidance(state, reading, navigationProgress(path, reading, 0, reading), destination);
  }
  assert.equal(rerouteDue(state, startTime + 4_000, 0, false, false), false);
  assert.equal(rerouteDue(state, startTime + 4_000, 0, true, true), false);
  assert.equal(rerouteDue(state, startTime + 4_000, 0, true, false), true);
  assert.equal(rerouteDue(state, startTime + 4_000, startTime, true, false), false);
  const final = fix(21.5, 45, 30, { breakBefore: true });
  const progress = navigationProgress(path, final, 0, final);
  state = observeGuidance(state, final, progress, destination);
  assert.equal(state.arrivalFixes, 1);
  assert.equal(observeGuidance(state, final, progress, destination), state);
  assert.equal(observeGuidance(state, { ...final, timestamp: final.timestamp + 1000, breakBefore: false }, progress, destination).arrivalFixes, 2);
  const beforeRequestedDestination = fix(21.49, 45, 33);
  assert.equal(observeGuidance(state, beforeRequestedDestination, navigationProgress(path, beforeRequestedDestination), destination).arrivalFixes, 0);
});

test('60-minute deterministic trip replay records precision, processing latency and reroute decisions', (context) => {
  const coordinates: [number, number][] = Array.from({ length: 361 }, (_, index) => [21 + .5 * index / 360, 45]);
  const meters = segmentMeters({ latitude: 45, longitude: 21 }, destination);
  const path = route([{ ...step(coordinates[0], coordinates.at(-1)!, 'depart', meters), duration: 3600, geometry: { coordinates } }]);
  const latencies: number[] = [];
  let largestSimulatedError = 0;
  let invalid = 0;
  let attempts = 0;
  let lastAttempt = 0;
  let state = initialGuidanceObservation;
  for (let seconds = 0; seconds <= 3600; seconds++) {
    const latitude = seconds >= 1850 && seconds < 1860 ? 45.002 : 45.00003;
    const reading = fix(21 + .5 * seconds / 3600, latitude, seconds, {
      speed: seconds < 100 ? 0 : seconds < 1800 ? 11 : 28,
      accuracy: seconds >= 1000 && seconds < 1030 ? 90 : 8,
    });
    if (!guidanceFix(reading, reading.timestamp)) { invalid++; continue; }
    const began = performance.now();
    const progress = navigationProgress(path, reading, 0, reading);
    state = observeGuidance(state, reading, progress, destination);
    if (rerouteDue(state, reading.timestamp, lastAttempt, true, false)) { attempts++; lastAttempt = reading.timestamp; }
    const displayed = routeDisplayFix(reading, progress, 0);
    latencies.push(performance.now() - began);
    if (latitude === 45.00003) largestSimulatedError = Math.max(largestSimulatedError, segmentMeters(displayed, { longitude: reading.longitude, latitude: 45 }));
  }
  const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * .95)];
  context.diagnostic(JSON.stringify({ replaySeconds: 3600, fixes: 3601, rejectedWeakFixes: invalid, syntheticDisplayErrorMaxMetres: +largestSimulatedError.toFixed(2), computeP95Ms: +p95.toFixed(3), rerouteDecisions: attempts, externalRequests: 0 }));
  assert.equal(invalid, 30);
  assert.equal(attempts, 1);
  assert.ok(largestSimulatedError < 4);
  assert.ok(state.arrivalFixes >= 2);
});
