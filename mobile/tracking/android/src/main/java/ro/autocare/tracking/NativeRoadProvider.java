package ro.autocare.tracking;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.util.Locale;
import org.json.*;
/** Navigation provider requests exist only in the Android bridge, never a browser HTTP route. */
final class NativeRoadProvider {
 private static final java.util.ArrayDeque<Long> searches=new java.util.ArrayDeque<>(),routes=new java.util.ArrayDeque<>();
 private static synchronized void rate(String kind)throws IOException{
  java.util.ArrayDeque<Long> list=kind.equals("search")?searches:routes;long now=System.nanoTime()/1000000;
  while(!list.isEmpty()&&now-list.peekFirst()>60000)list.removeFirst();
  if(list.size()>=(kind.equals("search")?12:8))throw new IOException("Navigation request limit reached");list.addLast(now);
 }
 static void validCoordinate(double latitude,double longitude){if(!Double.isFinite(latitude)||!Double.isFinite(longitude)||Math.abs(latitude)>85||Math.abs(longitude)>180)throw new IllegalArgumentException("Invalid coordinate");}
 private static String encodeQuery(String query){try{return URLEncoder.encode(query,"UTF-8");}catch(java.io.UnsupportedEncodingException error){throw new IllegalStateException(error);}}
 static String searchAddress(String query,double latitude,double longitude){
  validCoordinate(latitude,longitude);query=query.trim();if(query.length()<3||query.length()>160)throw new IllegalArgumentException("Invalid query");
  return "https://photon.komoot.io/api/?limit=12&q="+encodeQuery(query)+String.format(Locale.US,"&lat=%.2f&lon=%.2f",latitude,longitude);
 }
 static String routeAddress(double startLat,double startLon,double endLat,double endLon,double accuracy){
  validCoordinate(startLat,startLon);validCoordinate(endLat,endLon);if(!Double.isFinite(accuracy)||accuracy<0||accuracy>500)throw new IllegalArgumentException("Invalid accuracy");
  String pair=String.format(Locale.US,"%.5f,%.5f;%.5f,%.5f",startLon,startLat,endLon,endLat);
  return "https://routing.openstreetmap.de/routed-car/route/v1/driving/"+pair+"?steps=true&alternatives=true&overview=full&geometries=geojson&radiuses="+Math.max(250,(int)Math.ceil(accuracy))+";250";
 }
 static JSONObject request(JSONObject data)throws Exception{
  String kind=data.optString("kind"),address;
  if(kind.equals("search"))address=searchAddress(data.getString("query"),data.getDouble("latitude"),data.getDouble("longitude"));
  else if(kind.equals("route")){JSONObject start=data.getJSONObject("start"),end=data.getJSONObject("end");address=routeAddress(start.getDouble("latitude"),start.getDouble("longitude"),end.getDouble("latitude"),end.getDouble("longitude"),data.optDouble("accuracy",0));}
  else throw new IllegalArgumentException("Unsupported navigation operation");
  rate(kind);
  HttpURLConnection connection=(HttpURLConnection)new URL(address).openConnection();
  connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(12000);connection.setReadTimeout(12000);
  connection.setRequestProperty("Accept","application/json");connection.setRequestProperty("User-Agent","AutoCare-Android/4.0 (+https://www.autocareapp.ro)");
  try{
   if(connection.getResponseCode()!=200)throw new IOException("Navigation provider unavailable");
   try(InputStream stream=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];int count;while((count=stream.read(buffer))!=-1){if(out.size()+count>12*1024*1024)throw new IOException("Navigation response too large");out.write(buffer,0,count);}
    return new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));
   }
  }finally{connection.disconnect();}
 }
}
