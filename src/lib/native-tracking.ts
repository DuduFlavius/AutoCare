import {Capacitor,registerPlugin} from '@capacitor/core';
import {z} from 'zod';
import type {GPSFix} from './gps-tracking';
/** Native service owns the distance; JavaScript only reads snapshots. */
export type NativeTrip={id:string;ownerId:string;vehicleId:string;baseline:number;startedAt:number;updatedAt:number;endedAt?:number;lastFixAt?:number;distance:number;active:boolean;points:GPSFix[]};
interface TrackingPlugin {
 start(input:{id:string;ownerId:string;vehicleId:string;baseline:number}):Promise<unknown>;
 snapshot(input:{ownerId:string}):Promise<unknown>;
 stop(input:{ownerId:string}):Promise<unknown>;
 clear(input:{ownerId:string}):Promise<void>;
}
const plugin=registerPlugin<TrackingPlugin>('AutoCareTracking');
const point=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().nonnegative(),timestamp:z.number().positive(),breakBefore:z.boolean().optional()});
const trip=z.object({id:z.string().uuid(),ownerId:z.string().min(1),vehicleId:z.string().min(1),baseline:z.number().int().nonnegative(),startedAt:z.number().positive(),updatedAt:z.number().positive(),endedAt:z.number().positive().optional(),lastFixAt:z.number().nonnegative().optional(),distance:z.number().nonnegative(),active:z.boolean(),points:z.array(point).max(1500)});
export function readNativeTrip(value:unknown,ownerId:string):NativeTrip|null {
 const result=trip.safeParse(value);return result.success&&result.data.ownerId===ownerId?result.data:null;
}
export function hasNativeTracking(){return Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('AutoCareTracking');}
export const nativeTracking={
 async snapshot(ownerId:string){return readNativeTrip(await plugin.snapshot({ownerId}),ownerId);},
 async start(input:{id:string;ownerId:string;vehicleId:string;baseline:number}){const value=readNativeTrip(await plugin.start(input),input.ownerId);if(!value)throw Error('Nu s-a putut porni urmărirea GPS.');return value;},
 async stop(ownerId:string){return readNativeTrip(await plugin.stop({ownerId}),ownerId);},
 async clear(ownerId:string){await plugin.clear({ownerId});},
};
