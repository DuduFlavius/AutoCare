import assert from 'node:assert/strict';
import {test} from 'node:test';
import {queuePendingDrive,readPendingDrives,removePendingDrive,rememberDriveConfirmation,wasDriveConfirmed,type PendingDriveTrip} from '../src/lib/pending-drive-trips';

const first:PendingDriveTrip={
 id:'trip-1',vehicleId:'vehicle-1',expectedOdometer:90000,distanceMeters:2450,durationSeconds:160,pausedSeconds:10,
 startedAt:'2026-11-23T12:00:00.000Z',endedAt:'2026-11-23T12:02:50.000Z',syncMileage:true,points:[],
};
const second={...first,id:'trip-2',startedAt:'2026-11-23T12:05:00.000Z',endedAt:'2026-11-23T12:07:50.000Z'};
function disk(){
 const values=new Map<string,string>();
 return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)};
}
test('finished trips are isolated per account, retained after reload and deduplicated by ID',()=>{
 const storage=disk();
 queuePendingDrive('a',first,storage);
 queuePendingDrive('a',first,storage);
 queuePendingDrive('a',second,storage);
 assert.deepEqual(readPendingDrives('a',storage),[first,second]);
 assert.deepEqual(readPendingDrives('b',storage),[]);
});
test('confirmed mileage rebases later local trips of the same vehicle and matching baseline only',()=>{
 const storage=disk();
 queuePendingDrive('a',first,storage);
 queuePendingDrive('a',second,storage);
 queuePendingDrive('a',{...second,id:'other',vehicleId:'vehicle-2'},storage);
 queuePendingDrive('a',{...second,id:'manual-change',expectedOdometer:91000},storage);
 const remainder=removePendingDrive('a',first.id,90002,storage);
 assert.deepEqual(remainder.map(x=>x.expectedOdometer),[90002,90000,91000]);
 assert.deepEqual(readPendingDrives('a',storage).map(x=>x.id),['trip-2','other','manual-change']);
});
test('discard keeps the next baseline and a storage failure prevents persisting a new entry',()=>{
 const storage=disk();
 queuePendingDrive('a',first,storage);
 queuePendingDrive('a',second,storage);
 assert.equal(removePendingDrive('a',first.id,undefined,storage)[0].expectedOdometer,90000);
 assert.throws(()=>queuePendingDrive('a',first,{...storage,setItem:()=>{throw new Error('storage full');}}),/storage full/);
 assert.deepEqual(readPendingDrives('a',storage),[second]);
});

test('real address number matches rank ahead of duplicate street segments',async()=>{
 const {parseRoadDestinations}=await import('../src/lib/road-provider-data');
 const feature=(lon:number,properties:Record<string,string>)=>({
  geometry:{type:'Point',coordinates:[lon,44.43]},
  properties:{city:'București',country:'România',...properties},
 });
 const results=parseRoadDestinations({features:[
  feature(26.1,{type:'street',name:'Calea Victoriei'}),
  feature(26.11,{type:'street',name:'Calea Victoriei'}),
  feature(26.12,{type:'house',street:'Calea Victoriei',housenumber:'1-5'}),
 ]},45.75,21.23,'Calea Victoriei 1, București');
 assert.deepEqual(results.map(row=>row.name),['Calea Victoriei 1-5','Calea Victoriei']);
});

test('a backend-confirmed trip can be recognized after reopening even if the native slot remains',()=>{
 const storage=disk();
 rememberDriveConfirmation('a',first.id,storage);
 assert.equal(wasDriveConfirmed('a',first.id,storage),true);
 assert.equal(wasDriveConfirmed('b',first.id,storage),false);
 assert.equal(wasDriveConfirmed('a',second.id,storage),false);
});
