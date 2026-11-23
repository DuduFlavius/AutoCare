import type {GPSFix} from './gps-tracking';
import {segmentMeters} from './gps-tracking';

/** Presentation only: interpolate between measured fixes, never extrapolate a route. */
export function measuredTransition(from:GPSFix|null,to:GPSFix,reducedMotion=false){
 if(!from||reducedMotion)return 0;
 const elapsed=to.timestamp-from.timestamp;
 if(elapsed<=0||elapsed>15000)return 0;
 // Do not animate a GPS jump as if it were a real movement.
 if(segmentMeters(from,to)/(elapsed/1000)>80)return null;
 return Math.min(1500,Math.max(250,elapsed));
}
export function interpolateAngle(from:number,to:number,progress:number){
 const delta=((to-from+540)%360)-180;
 return (from+delta*Math.max(0,Math.min(1,progress))+360)%360;
}
export function interpolateFix(from:GPSFix,to:GPSFix,progress:number):GPSFix{
 const t=Math.max(0,Math.min(1,progress));
 if(t===1)return {...to};
 if(t===0)return {...to,latitude:from.latitude,longitude:from.longitude};
 const longitudeDelta=((to.longitude-from.longitude+540)%360)-180;
 return {...to,latitude:from.latitude+(to.latitude-from.latitude)*t,longitude:((from.longitude+longitudeDelta*t+540)%360)-180};
}
