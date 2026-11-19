import test from 'node:test';
import assert from 'node:assert/strict';
import { driveFrame, shortestAngle } from '../src/lib/drive-camera';
import type { GPSFix } from '../src/lib/gps-tracking';

const previous: GPSFix = { latitude: 45.75, longitude: 21.23, accuracy: 6, timestamp: 1000 };

test('drive view keeps the shortest heading across north and zooms out at speed', () => {
  const next = { ...previous, timestamp: 2000, heading: 2, speed: 20 };
  const frame = driveFrame(previous, next, 358);
  assert.equal(frame.bearing, 362);
  assert.equal(shortestAngle(2, 358), -4);
  assert.ok(frame.duration > 0 && frame.duration < 1000);
  assert.ok(frame.zoom < driveFrame(previous, { ...next, speed: 3 }, 358).zoom);
  assert.ok(driveFrame(previous, next, 358, 50).zoom > frame.zoom);
});

test('drive view ignores stationary drift and never interpolates across signal breaks', () => {
  const drift = { ...previous, timestamp: 2000, latitude: 45.75001, speed: 0, heading: 150 };
  assert.equal(driveFrame(previous, drift, 35).hold, true);
  assert.equal(driveFrame(previous, drift, 35).bearing, 35);
  assert.equal(driveFrame(previous, { ...drift, timestamp: 12000 }, 35).duration, 0);
  assert.equal(driveFrame(previous, { ...drift, breakBefore: true }, 35).duration, 0);
});

test('drive view holds the last reliable position for an implausible jump', () => {
  const jump = { ...previous, timestamp: 2000, latitude: 45.76, speed: 15, heading: 20 };
  const frame = driveFrame(previous, jump, 180);
  assert.equal(frame.outlier, true);
  assert.equal(frame.hold, true);
  assert.equal(frame.bearing, 180);
});
