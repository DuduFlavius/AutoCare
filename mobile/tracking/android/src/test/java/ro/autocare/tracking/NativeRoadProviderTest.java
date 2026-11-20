package ro.autocare.tracking;
import static org.junit.Assert.*;
import org.junit.Test;
import java.net.URI;
public class NativeRoadProviderTest{
 @Test public void searchEncodesQueryAndUsesOnlyApprovedProvider()throws Exception{
  String url=NativeRoadProvider.searchAddress("Service & cafe/near?x=1",45.7247,21.1987);
  URI uri=new URI(url);assertEquals("https",uri.getScheme());assertEquals("photon.komoot.io",uri.getHost());assertTrue(url.contains("%26"));assertTrue(url.contains("lat=45.72&lon=21.20"));
 }
 @Test public void routePreservesCoordinateOrderAndRealAccuracyRadius(){
  String url=NativeRoadProvider.routeAddress(45.7,21.2,45.71,21.21,320);
  assertTrue(url.contains("21.20000,45.70000;21.21000,45.71000"));assertTrue(url.endsWith("radiuses=320;250"));assertTrue(url.startsWith("https://routing.openstreetmap.de/"));
 }
 @Test public void invalidGpsCoordinatesAreRejected(){
  for(double value:new double[]{Double.NaN,Double.POSITIVE_INFINITY,86,-86})try{NativeRoadProvider.validCoordinate(value,21);fail("Invalid GPS accepted");}catch(IllegalArgumentException expected){}
 }
 @Test public void invalidQueryAndAccuracyAreRejected(){
  try{NativeRoadProvider.searchAddress("a",45,21);fail();}catch(IllegalArgumentException expected){}
  try{NativeRoadProvider.routeAddress(45,21,46,22,Double.NaN);fail();}catch(IllegalArgumentException expected){}
  try{NativeRoadProvider.routeAddress(45,21,46,22,501);fail();}catch(IllegalArgumentException expected){}
 }
}
