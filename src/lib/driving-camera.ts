import {segmentMeters,type GPSFix} from './gps-tracking';
/** Bearings take the short arc across north and never turn on stationary GPS noise. */
export function drivingBearing(previous:GPSFix|null,next:GPSFix,current=0){
 if(next.accuracy>50||next.breakBefore||(next.speed!=null&&next.speed<0.7))return current;
 const elapsed=previous?(next.timestamp-previous.timestamp)/1000:0;
 const moved=previous&&elapsed>0&&elapsed<20?segmentMeters(previous,next):0;
 if((next.speed==null||!Number.isFinite(next.speed)||next.speed<1.5)&&moved<Math.max(10,Math.min(25,next.accuracy+(previous?.accuracy??0))))return current;
 let target=next.heading;
 if(target==null||!Number.isFinite(target)||target<0||target>=360){
  if(!previous||moved<10)return current;
  const r=Math.PI/180,a=previous.latitude*r,b=next.latitude*r,d=(next.longitude-previous.longitude)*r;
  target=(Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))/r+360)%360;
 }
 const delta=((target-current+540)%360)-180;
 return (current+delta*.4+360)%360;
}
const clamp = (value:number, min:number, max:number) => Math.max(min, Math.min(max, value));

export function drivingView(speed:number|null|undefined, untilTurn?:number){
 const kmh=clamp((Number.isFinite(speed)?speed!:0)*3.6,0,130);
 const velocity=kmh/130;
 const approach=untilTurn!=null&&untilTurn>=0?clamp(1-(untilTurn-35)/265,0,1):0;
 const zoom=18.25-1.52*velocity;
 const pitch=62-7*velocity;
 return {zoom:zoom+(18.55-zoom)*approach*.82,pitch:pitch+(64-pitch)*approach*.68};
}
export function drivingZoom(speed:number|null|undefined,untilTurn?:number){
 return drivingView(speed,untilTurn).zoom;
}

/** Give the lens its own settling time even when the car is not moving. */
export function cameraSettlingTime(distanceMs:number, angle:number, lensChanged:boolean, reducedMotion:boolean){
 if(reducedMotion)return 0;
 return Math.max(distanceMs,angle>1?clamp(angle*11,280,1400):0,lensChanged?700:0);
}
export function daylightMap(hour:number){return hour>=7&&hour<19;}

export function drivingInsets(height:number, header:number, dock:number) {
 const available=Math.max(0,height-header-dock);
 const shift=available>40 ? 2*(header+available*.76)-height : 0;
 return {top:Math.max(0,shift),bottom:Math.max(0,-shift),left:0,right:0};
}
