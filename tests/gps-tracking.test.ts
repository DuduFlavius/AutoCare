import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptGPSFix,browserGPSFix,latestGPSFix,type GPSFix} from '../src/lib/gps-tracking';
const fix=(meters:number,seconds:number):GPSFix=>({latitude:45+meters/111195,longitude:21,accuracy:5,timestamp:seconds*1000});
test('small successive movements accumulate instead of disappearing',()=>{let anchor:GPSFix|null=null,total=0;for(let i=0;i<=60;i++){const next=acceptGPSFix(anchor,fix(i,i));if(next){anchor=next.point;total+=next.meters;}}assert.ok(total>54&&total<61);});
test('stationary jitter and inaccurate coordinates are rejected',()=>{assert.equal(acceptGPSFix(fix(0,0),fix(2,3)),null);assert.equal(acceptGPSFix(fix(0,0),fix(7,3)),null);assert.equal(acceptGPSFix(null,{...fix(0,0),accuracy:100}),null);assert.equal(acceptGPSFix(null,{...fix(0,0),latitude:NaN}),null);});
test('teleports and backwards timestamps do not poison the anchor',()=>{assert.equal(acceptGPSFix(fix(0,1),fix(10000,2)),null);assert.equal(acceptGPSFix(fix(0,1),fix(10,0)),null);assert.ok(acceptGPSFix(fix(0,1),fix(20,3)));});
test('signal gaps start a new segment without fabricated distance',()=>{const next=acceptGPSFix(fix(0,0),fix(5000,100));assert.equal(next?.meters,0);assert.equal(next?.point.breakBefore,true);});

test('reported standstill prevents GPS drift from increasing distance',()=>{assert.equal(acceptGPSFix(fix(0,0),{...fix(20,10),speed:0}),null);assert.ok(acceptGPSFix(fix(0,0),{...fix(20,10),speed:2}));});

test('the map displays an approximate position while trip distance still requires a precise fix', () => {
  const coords = { latitude: 45.75, longitude: 21.23, accuracy: 160, heading: null, speed: 0, altitude: null, altitudeAccuracy: null, toJSON: () => ({}) };
  const sample = { coords, timestamp: 1500, toJSON: () => ({}) };
  const position = browserGPSFix(sample);
  assert.equal(position?.accuracy, 160);
  assert.equal(position?.longitude, 21.23);
  assert.ok(position);
  assert.equal(acceptGPSFix(null, position), null);
  assert.equal(browserGPSFix({ ...sample, coords: { ...coords, latitude: 100 } }), null);
});

test('the map uses the newest fix regardless of arrival order', () => {
  const earlier = fix(0, 10);
  const later = fix(8, 11);
  assert.equal(latestGPSFix(later, earlier), later);
  assert.equal(latestGPSFix(earlier, later), later);
  assert.equal(latestGPSFix(earlier, null), earlier);
  assert.equal(latestGPSFix(null, null), null);
});
