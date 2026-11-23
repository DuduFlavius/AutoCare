import {segmentMeters,type GPSFix} from './gps-tracking';
export type DriveClock={startedAt:number;elapsedMs:number;runningSince:number|null;endedAt:number|null};
export const startDriveClock=(now:number):DriveClock=>({startedAt:now,elapsedMs:0,runningSince:now,endedAt:null});
export function driveElapsedMs(clock:DriveClock,now:number){return Math.max(0,clock.elapsedMs+(clock.runningSince===null?0:Math.max(0,now-clock.runningSince)));}
export function pauseDriveClock(clock:DriveClock,now:number):DriveClock{return clock.endedAt||clock.runningSince===null?clock:{...clock,elapsedMs:driveElapsedMs(clock,now),runningSince:null};}
export function resumeDriveClock(clock:DriveClock,now:number):DriveClock{return clock.endedAt||clock.runningSince!==null?clock:{...clock,runningSince:now};}
export function finishDriveClock(clock:DriveClock,now:number):DriveClock{return clock.endedAt?clock:{...pauseDriveClock(clock,now),endedAt:now};}
export function driveStats(meters:number,seconds:number,maxSpeed:number|null){return {averageKmh:seconds>0&&(meters>0||maxSpeed!==null)?Math.round(Math.max(0,meters)/seconds*3.6):null,maximumKmh:maxSpeed===null?null:Math.round(maxSpeed)};}
export function measuredSpeed(current:GPSFix,previous:GPSFix|null){
 if(current.accuracy>50)return null;
 if(current.speed!=null)return Number.isFinite(current.speed)&&current.speed>=0&&current.speed<=55?current.speed*3.6:null;
 if(!previous||previous.accuracy>25||current.accuracy>25||current.breakBefore)return null;
 const seconds=(current.timestamp-previous.timestamp)/1000;
 if(seconds<=0||seconds>10)return null;
 const meters=segmentMeters(previous,current),speed=meters/seconds;
 return meters>=Math.max(5,previous.accuracy+current.accuracy)&&speed<=55?speed*3.6:null;
}
/** Active time and paused time partition wall time, with the existing clock tolerance. */
export function validTripTiming(startedAt:number,endedAt:number,durationSeconds:number,pausedSeconds:number){
 const wall=(endedAt-startedAt)/1000;
 return wall>=0&&pausedSeconds>=0&&pausedSeconds<=wall&&Math.abs(wall-pausedSeconds-durationSeconds)<=60;
}
