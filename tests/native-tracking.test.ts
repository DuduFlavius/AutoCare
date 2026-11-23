import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readNativeTrip,hasNativeTracking} from '../src/lib/native-tracking';
const trip={id:'b3e1d284-ce52-42b9-b1ae-59659932eb5a',ownerId:'alice',vehicleId:'car-1',baseline:82000,startedAt:1000,updatedAt:2000,distance:1234,active:true,points:[{latitude:45,longitude:21,accuracy:5,timestamp:2000}]};
test('native snapshots are account-scoped and cannot replace trusted state with invalid data',()=>{assert.equal(readNativeTrip(trip,'bob'),null);assert.equal(readNativeTrip({...trip,distance:-1},'alice'),null);assert.equal(readNativeTrip({...trip,points:[{latitude:100,longitude:21,accuracy:5,timestamp:2000}]},'alice'),null);assert.equal(readNativeTrip({},'alice'),null);assert.equal(readNativeTrip(trip,'alice')?.distance,1234);});
test('ordinary browsers never advertise background native tracking',()=>assert.equal(hasNativeTracking(),false));

test('live native position updates independently of filtered route and validates coordinates',()=>{
  const lastPosition={latitude:45.001,longitude:21.001,accuracy:8,timestamp:3000};
  const snapshot=readNativeTrip({...trip,lastPosition},'alice');
  assert.deepEqual(snapshot?.lastPosition,lastPosition);
  assert.deepEqual(snapshot?.points,trip.points);
  assert.equal(snapshot?.distance,trip.distance);
  assert.equal(readNativeTrip({...trip,lastPosition:{...lastPosition,latitude:91}},'alice'),null);
});

test('native telemetry retains real speed and bearing and durable paused timing',()=>{
 const lastPosition={latitude:45.001,longitude:21.001,accuracy:8,timestamp:3000,speed:20,heading:355};
 const result=readNativeTrip({...trip,lastPosition,paused:true,pausedAt:2500,pausedMillis:100,maxSpeedKmh:91},'alice');
 assert.equal(result?.lastPosition?.speed,20);assert.equal(result?.lastPosition?.heading,355);
 assert.equal(result?.paused,true);assert.equal(result?.pausedMillis,100);assert.equal(result?.maxSpeedKmh,91);
 assert.equal(readNativeTrip({...trip,pausedMillis:-1},'alice'),null);
 assert.equal(readNativeTrip({...trip,lastPosition:{...lastPosition,speed:56}},'alice'),null);
});
