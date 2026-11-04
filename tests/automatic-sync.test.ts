import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {nativeAutomation,nativeTracking,type NativeTrip} from '../src/lib/native-tracking';
import {syncAutomaticTrips} from '../src/lib/sync-automatic-trips';
const owner='owner-1',car={id:'car-1',odometer:10000};
const trip:NativeTrip={id:'34b0e891-3488-49c1-8775-796dbd60f68c',ownerId:owner,vehicleId:car.id,baseline:10000,startedAt:1700000000000,updatedAt:1700000600000,endedAt:1700000600000,distance:1500,active:false,automatic:true,points:[]};
function fixture(t:TestContext){
 const originals={pending:nativeAutomation.pending,acknowledge:nativeAutomation.acknowledge,update:nativeAutomation.updateVehicle,snapshot:nativeTracking.snapshot,fetch:globalThis.fetch,window:Object.getOwnPropertyDescriptor(globalThis,'window')};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:()=>true}});
 nativeAutomation.pending=async()=>[trip];nativeTracking.snapshot=async()=>trip;
 const acks:string[][]=[],updates:number[]=[];nativeAutomation.acknowledge=async(_owner,ids)=>{acks.push(ids);};nativeAutomation.updateVehicle=async(_owner,_car,km)=>{updates.push(km);};
 t.after(()=>{nativeAutomation.pending=originals.pending;nativeAutomation.acknowledge=originals.acknowledge;nativeAutomation.updateVehicle=originals.update;nativeTracking.snapshot=originals.snapshot;globalThis.fetch=originals.fetch;if(originals.window)Object.defineProperty(globalThis,'window',originals.window);else Reflect.deleteProperty(globalThis,'window');});
 return {acks,updates};
}
test('safe sync uses the confirmed server mileage for the next automatic trip',async t=>{const f=fixture(t);globalThis.fetch=async(_url,input)=>{const value=JSON.parse(String(input?.body));assert.equal(value.expectedOdometer,10000);assert.equal(value.trips[0].distanceMeters,1500);return Response.json({ids:[trip.id],odometer:10002},{status:201});};assert.equal(await syncAutomaticTrips(owner,[car]),1);assert.deepEqual(f.acks,[[trip.id]]);assert.deepEqual(f.updates,[10002]);});
test('odometer conflicts retain the local outbox and never acknowledge unsaved trips',async t=>{const f=fixture(t);globalThis.fetch=async()=>Response.json({error:'Mileage conflict'},{status:409});await assert.rejects(syncAutomaticTrips(owner,[car]),/Mileage conflict/);assert.equal(f.acks.length,0);assert.equal(f.updates.length,0);});
test('a currently recording vehicle is never synced mid-trip',async t=>{const f=fixture(t);nativeTracking.snapshot=async()=>({...trip,active:true});globalThis.fetch=async()=>{throw Error('Should not send an active trip');};assert.equal(await syncAutomaticTrips(owner,[car]),0);assert.equal(f.acks.length,0);});
