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
 if(untilTurn!=null&&untilTurn>=0&&untilTurn<180)return 17.5;
 const kmh=Math.max(0,speed??0)*3.6;
 return kmh>90?15.4:kmh>50?16:16.8;
}
export function daylightMap(hour:number){return hour>=7&&hour<19;}
