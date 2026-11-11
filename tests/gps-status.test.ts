import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gpsSignal, gpsTelemetry } from '../src/lib/gps-status';
const now = 1700000000000;
const fix = { latitude: 45.7, longitude: 21.2, accuracy: 5, timestamp: now, speed: 10 };
test('GPS off never fabricates telemetry, and acquisition is distinct from connected', () => {
 assert.deepEqual(gpsTelemetry(null, now), { accuracy: null, speed: null, fresh: false });
 assert.equal(gpsSignal({position:null,now,requested:false,failed:false}), 'off');
 assert.equal(gpsSignal({position:null,now,requested:true,failed:false}), 'searching');
 assert.equal(gpsSignal({position:fix,now,requested:true,failed:false}), 'connected');
});
test('permission denial and acquisition failure report errors instead of a connection', () => {
 assert.equal(gpsSignal({position:fix,now,requested:true,failed:false,denied:true}), 'error');
 assert.equal(gpsSignal({position:null,now,requested:true,failed:true}), 'error');
});
test('weak fixes expose real accuracy but suppress unreliable speed', () => {
 assert.deepEqual(gpsTelemetry({...fix,accuracy:150},now), { accuracy:150,speed:null,fresh:true });
 assert.equal(gpsSignal({position:{...fix,accuracy:150},now,requested:true,failed:false}), 'weak');
});
test('stale, impossible and future coordinates do not display speed or precision', () => {
 for (const bad of [{...fix,timestamp:now-25001},{...fix,timestamp:now+6000},{...fix,latitude:91},{...fix,accuracy:-1},{...fix,longitude:NaN}]) assert.deepEqual(gpsTelemetry(bad,now), {accuracy:null,speed:null,fresh:false});
 assert.equal(gpsSignal({position:fix,now:now+26000,requested:true,failed:false}), 'stale');
});
test('valid speeds convert m/s to km/h; missing, negative and excessive speeds remain unavailable', () => {
 assert.equal(gpsTelemetry(fix,now).speed,36);
 assert.equal(gpsTelemetry({...fix,speed:0},now).speed,0);
 for (const speed of [null,NaN,-1,56]) assert.equal(gpsTelemetry({...fix,speed},now).speed,null);
});
