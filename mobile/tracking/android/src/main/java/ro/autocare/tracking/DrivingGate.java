package ro.autocare.tracking;
/** Confirm driving from sustained measured movement; pairing or connection alone is insufficient. */
final class DrivingGate {
 static boolean qualifies(int samples,long elapsedMs,double meters){
  return samples>=3&&elapsedMs>=10000&&elapsedMs<=120000&&Double.isFinite(meters)&&meters>=50;
 }
 static boolean usableSpeed(boolean hasSpeed,float speed){return hasSpeed&&Float.isFinite(speed)&&speed>=2.5f&&speed<=55;}
}
