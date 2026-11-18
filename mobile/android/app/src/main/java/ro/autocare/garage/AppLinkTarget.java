package ro.autocare.garage;
import java.net.URI;
import java.net.URLDecoder;
/** Only verified AutoCare links may navigate the authenticated WebView. */
public final class AppLinkTarget {
 private static final String ORIGIN="https://www.autocareapp.ro";
 private AppLinkTarget(){}
 public static String destination(String value){
  if(value==null)return null;
  try{
   URI uri=URI.create(value);
   if(!"https".equalsIgnoreCase(uri.getScheme())||!"www.autocareapp.ro".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443))return null;
   if("/cont".equals(uri.getPath()))return ORIGIN+"/cont"+(uri.getRawQuery()==null?"":"?"+uri.getRawQuery());
   if(!"/open-app".equals(uri.getPath()))return null;
   String next="/cont";boolean found=false;
   if(uri.getRawQuery()!=null)for(String field:uri.getRawQuery().split("&")){String[] pair=field.split("=",2);if("next".equals(pair[0])){if(found)return ORIGIN+"/cont";found=true;next=pair.length==2?URLDecoder.decode(pair[1],"UTF-8"):"/cont";}}
   return ORIGIN+safePath(next);
  }catch(IllegalArgumentException|java.io.UnsupportedEncodingException error){return null;}
 }
 private static String safePath(String path){
  if(path.length()>2048||!path.startsWith("/")||path.startsWith("//")||path.indexOf('\\')>=0||path.matches("(?s).*[\\x00-\\x1f\\x7f].*")||path.toLowerCase(java.util.Locale.ROOT).matches(".*%(5c|0a|0d).*"))return "/cont";
  try{URI uri=URI.create(path).normalize();String clean=uri.getPath();if(uri.getRawPath().toLowerCase(java.util.Locale.ROOT).matches(".*%(2f|5c|2e).*"))return "/cont";if(uri.isAbsolute()||uri.getRawAuthority()!=null||clean==null||clean.equals("/open-app")||clean.startsWith("/open-app/")||clean.equals("/api")||clean.startsWith("/api/"))return "/cont";return uri.toASCIIString();}catch(IllegalArgumentException error){return "/cont";}
 }
}
