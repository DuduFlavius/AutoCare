import type {GPSFix} from './gps-tracking';
import {segmentMeters} from './gps-tracking';

/** Presentation only: interpolate between measured fixes, never extrapolate a route. */
export function measuredTransition(from:GPSFix|null,to:GPSFix,reducedMotion=false){
 if(!from)return 0;
 const elapsed=to.timestamp-from.timestamp;
 if(elapsed===0)return segmentMeters(from,to)>0.01?null:0;
 if(elapsed<0)return null;
 const distance=segmentMeters(from,to);
 // Discard physically impossible fixes even when the GPS returns after an outage.
 if(distance/(elapsed/1000)>80)return null;
 // Reacquisition relocates to a confirmed fix without animating across the unobserved gap.
 if(elapsed>15000||to.breakBefore)return 0;
 return reducedMotion?0:Math.min(3000,Math.max(250,elapsed));
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


/** Smooth the camera angle independently of the linear, measured marker path. */
export function cameraTurnProgress(progress:number){
 const t=Math.max(0,Math.min(1,progress));
 return t*t*(3-2*t);
}
