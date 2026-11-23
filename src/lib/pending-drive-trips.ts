import type {GPSFix} from './gps-tracking';

export type PendingDriveTrip={
 id:string;vehicleId:string;expectedOdometer:number;distanceMeters:number;durationSeconds:number;pausedSeconds:number;
 startedAt:string;endedAt:string;syncMileage:boolean;points:GPSFix[];
};
type StorageArea=Pick<Storage,'getItem'|'setItem'>;
const key=(ownerId:string)=>'autocare-pending-drives-v1:'+ownerId;
export function readPendingDrives(ownerId:string,storage:StorageArea=localStorage):PendingDriveTrip[]{
 const raw=storage.getItem(key(ownerId));
 if(!raw)return [];
 const entries:PendingDriveTrip[]=JSON.parse(raw);
 if(!Array.isArray(entries)||entries.some(row=>!row||typeof row.id!=='string'||typeof row.vehicleId!=='string'||
    !Number.isFinite(row.distanceMeters)||!Array.isArray(row.points)))throw Error('Coada GPS locală nu poate fi citită.');
 return entries;
}

/** Write before releasing the native recording slot. A storage failure leaves the original trip intact. */
export function queuePendingDrive(ownerId:string,trip:PendingDriveTrip,storage:StorageArea=localStorage){
 const entries=readPendingDrives(ownerId,storage);
 if(entries.some(row=>row.id===trip.id))return entries;
 const next=[...entries,trip];
 storage.setItem(key(ownerId),JSON.stringify(next));
 return next;
}

export function removePendingDrive(ownerId:string,id:string,confirmedOdometer?:number,storage:StorageArea=localStorage){
 const entries=readPendingDrives(ownerId,storage);
 const removed=entries.find(row=>row.id===id);
 const next=entries.filter(row=>row.id!==id).map(row=>
  removed?.syncMileage&&confirmedOdometer!==undefined&&row.vehicleId===removed.vehicleId&&
  row.expectedOdometer===removed.expectedOdometer&&row.startedAt>=removed.endedAt
   ? {...row,expectedOdometer:confirmedOdometer}:row);
 storage.setItem(key(ownerId),JSON.stringify(next));
 return next;
}

const receiptKey=(ownerId:string)=>'autocare-confirmed-drives-v1:'+ownerId;
function receipts(ownerId:string,storage:StorageArea):string[]{
 try{
  const rows:unknown=JSON.parse(storage.getItem(receiptKey(ownerId))??'[]');
  return Array.isArray(rows)?rows.filter((id):id is string=>typeof id==='string'):[];
 }catch{return [];}
}

export function wasDriveConfirmed(ownerId:string,id:string,storage:StorageArea=localStorage){
 return receipts(ownerId,storage).includes(id);
}

export function rememberDriveConfirmation(ownerId:string,id:string,storage:StorageArea=localStorage){
 const rows=receipts(ownerId,storage).filter(value=>value!==id);
 storage.setItem(receiptKey(ownerId),JSON.stringify([...rows,id].slice(-100)));
}
