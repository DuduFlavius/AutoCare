import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readNativeTrip,hasNativeTracking} from '../src/lib/native-tracking';
const trip={id:'b3e1d284-ce52-42b9-b1ae-59659932eb5a',ownerId:'alice',vehicleId:'car-1',baseline:82000,startedAt:1000,updatedAt:2000,distance:1234,active:true,points:[{latitude:45,longitude:21,accuracy:5,timestamp:2000}]};
test('native snapshots are account-scoped and cannot replace trusted state with invalid data',()=>{assert.equal(readNativeTrip(trip,'bob'),null);assert.equal(readNativeTrip({...trip,distance:-1},'alice'),null);assert.equal(readNativeTrip({...trip,points:[{latitude:100,longitude:21,accuracy:5,timestamp:2000}]},'alice'),null);assert.equal(readNativeTrip({},'alice'),null);assert.equal(readNativeTrip(trip,'alice')?.distance,1234);});
test('ordinary browsers never advertise background native tracking',()=>assert.equal(hasNativeTracking(),false));
