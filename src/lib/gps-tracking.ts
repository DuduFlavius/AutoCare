/** Accepted fixes form distance anchors, so small real movements accumulate. */
export type GPSFix = { latitude: number; longitude: number; accuracy: number; timestamp: number; speed?: number | null; breakBefore?: boolean };
const radians = (n: number) => n * Math.PI / 180;
export function segmentMeters(a: GPSFix, b: GPSFix): number {
  const h = Math.sin(radians(b.latitude-a.latitude)/2)**2 + Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(radians(b.longitude-a.longitude)/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function acceptGPSFix(anchor: GPSFix | null, next: GPSFix) {
  if (![next.latitude,next.longitude,next.accuracy,next.timestamp].every(Number.isFinite) || Math.abs(next.latitude)>90 || Math.abs(next.longitude)>180 || next.accuracy<0 || next.accuracy>50) return null;
  if (!anchor) return { point: {...next,breakBefore:true}, meters:0 };
  const seconds=(next.timestamp-anchor.timestamp)/1000;
  if(seconds<=0) return null;
  if(seconds>45) return {point:{...next,breakBefore:true},meters:0};
  if(next.speed!=null && (!Number.isFinite(next.speed)||next.speed<0.7||next.speed>55))return null;
  const meters=segmentMeters(anchor,next);
  if(meters/seconds>55 || meters<Math.max(5,Math.min(20,(anchor.accuracy+next.accuracy)/2))) return null;
  return {point:next,meters};
}
