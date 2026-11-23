import {nativeNavigation} from './native-tracking';
import type {DrivingRoute} from './road-navigation';
import type {DriveDestination} from '@/components/drive-destination-search';
async function request<T>(path:string,input:unknown):Promise<T>{const response=await fetch('/api/v1/smartdrive/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Serviciul de navigație este indisponibil.');return data;}
export const driveRouting={
 search:async(query:string,latitude:number,longitude:number):Promise<DriveDestination[]>=>nativeNavigation.available()?nativeNavigation.search(query,latitude,longitude):request('destinations',{query,latitude,longitude}),
 directions:async(start:{latitude:number;longitude:number},end:{latitude:number;longitude:number},accuracy:number):Promise<DrivingRoute[]>=>nativeNavigation.available()?nativeNavigation.directions(start,end,accuracy):request('directions',{start,end,accuracy})
};
