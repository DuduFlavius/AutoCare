import {nativeNavigation} from './native-tracking';
import type {Coordinate,DrivingRoute} from './road-navigation';
import type {DriveDestination} from '@/components/drive-destination-search';

class NavigationHttpError extends Error {
 constructor(message:string,readonly status:number){super(message);}
}
async function request<T>(path:string,input:unknown,native:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
 try{
  const response=await fetch('/api/v1/smartdrive/'+path,{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store',signal,
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!Array.isArray(data))throw new NavigationHttpError(data?.error||'Serviciul de navigație este indisponibil.',response.status);
  return data as T;
 }catch(error){
  signal?.throwIfAborted();
  // The Android bridge is a fallback for an unavailable endpoint, not a way around request limits.
  if(!nativeNavigation.available()||(error instanceof NavigationHttpError&&error.status>=400&&error.status<500&&error.status!==404))throw error;
  const result=await native();
  signal?.throwIfAborted();
  return result;
 }
}
export const driveRouting={
 search:(query:string,latitude:number,longitude:number,signal?:AbortSignal)=>request<DriveDestination[]>(
  'destinations',{query,latitude,longitude},()=>nativeNavigation.search(query,latitude,longitude),signal),
 directions:(start:Coordinate,end:Coordinate,accuracy:number,signal?:AbortSignal)=>request<DrivingRoute[]>(
  'directions',{start,end,accuracy},()=>nativeNavigation.directions(start,end,accuracy),signal),
};
