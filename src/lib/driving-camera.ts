import {segmentMeters,type GPSFix} from './gps-tracking';
/** Bearings take the short arc across north and never turn on stationary GPS noise. */
export function drivingBearing(previous:GPSFix|null,next:GPSFix,current=0){
 if(next.accuracy>50||next.breakBefore)return current;
 const elapsed=previous?(next.timestamp-previous.timestamp)/1000:0;
 const moved=previous&&elapsed>0&&elapsed<20?segmentMeters(previous,next):0;
 if((next.speed==null||!Number.isFinite(next.speed)||next.speed<1.5)&&moved<10)return current;
 let target=next.heading;
 if(target==null||!Number.isFinite(target)||target<0||target>=360){
  if(!previous||moved<10)return current;
  const r=Math.PI/180,a=previous.latitude*r,b=next.latitude*r,d=(next.longitude-previous.longitude)*r;
  target=(Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))/r+360)%360;
 }
 const delta=((target-current+540)%360)-180;
 return (current+delta*.4+360)%360;
}
export function drivingZoom(speed:number|null|undefined,untilTurn?:number){
 const kmh=Math.max(0,Number.isFinite(speed)?speed!:0)*3.6;
 const cruise=17.15-Math.min(1,kmh/120)*1.75;
 const proximity=untilTurn!=null&&untilTurn>=0?Math.max(0,1-untilTurn/220):0;
 return cruise+(17.5-cruise)*proximity;
}
export function daylightMap(hour:number){return hour>=7&&hour<19;}

export function drivingInsets(height:number, header:number, dock:number) {
 const available=Math.max(0,height-header-dock);
 const shift=available>40 ? 2*(header+available*.70)-height : 0;
 return {top:Math.max(0,shift),bottom:Math.max(0,-shift),left:0,right:0};
}
