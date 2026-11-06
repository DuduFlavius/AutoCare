package ro.autocare.tracking;
import android.Manifest;
import android.bluetooth.*;
import android.companion.CompanionDeviceManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.*;
import java.util.UUID;

/** Local opt-in associations; no credentials, network requests or server odometers. */
final class AutoDrive {
    static final long STOP_DELAY=10000L;
    static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("autocare-auto-drive",Context.MODE_PRIVATE);}
    static JSONObject bindings(Context c){try{return new JSONObject(prefs(c).getString("bindings","{}"));}catch(Exception e){return new JSONObject();}}
    static JSONArray pending(Context c,String owner){try{return new JSONArray(prefs(c).getString("pending-"+owner,"[]"));}catch(Exception e){return new JSONArray();}}
    static void enqueue(Context c,JSONObject state)throws JSONException{synchronized(TrackingStore.class){
        if(!state.optBoolean("automatic")||state.optDouble("distance")<=0)return;
        String owner=state.optString("ownerId");JSONArray queue=pending(c,owner);
        for(int i=0;i<queue.length();i++)if(queue.getJSONObject(i).optString("id").equals(state.optString("id")))return;
        JSONObject summary=new JSONObject(state.toString());summary.put("points",new JSONArray());queue.put(summary);
        if(!prefs(c).edit().putString("pending-"+owner,queue.toString()).commit())throw new IllegalStateException("Unable to queue GPS trip");
    }}
    static void acknowledge(Context c,String owner,JSONArray ids)throws JSONException{synchronized(TrackingStore.class){
        JSONArray queue=pending(c,owner),keep=new JSONArray();
        for(int i=0;i<queue.length();i++){JSONObject row=queue.getJSONObject(i);boolean found=false;for(int j=0;j<ids.length();j++)if(row.optString("id").equals(ids.getString(j)))found=true;if(!found)keep.put(row);}
        if(!prefs(c).edit().putString("pending-"+owner,keep.toString()).commit())throw new IllegalStateException("Unable to acknowledge GPS trips");
        JSONObject current=TrackingStore.read(c);if(owner.equals(current.optString("ownerId"))&&!current.optBoolean("active")){for(int j=0;j<ids.length();j++)if(current.optString("id").equals(ids.getString(j)))TrackingStore.clearOwner(c,owner);}
    }}
    static void configure(Context c,JSONObject config)throws JSONException{synchronized(TrackingStore.class){
        JSONObject all=bindings(c);String address=config.getString("address").toUpperCase(java.util.Locale.ROOT);
        if(!CarIdentity.valid(address)||config.optString("ownerId").isEmpty()||config.optString("vehicleId").isEmpty()||config.optInt("baseline",-1)<0)throw new IllegalArgumentException("Invalid car association");
        JSONObject active=TrackingStore.read(c);if(active.optBoolean("active"))throw new IllegalStateException("Stop the current trip before changing car associations");
        config.put("address",address);
        JSONObject old=all.optJSONObject(address);if(old!=null&&old.optBoolean("enabled")&&!old.optString("ownerId").equals(config.optString("ownerId")))throw new IllegalStateException("Bluetooth already associated with another account");
        // Exactly one Bluetooth identity per vehicle, and one vehicle per identity.
        for(java.util.Iterator<String> it=all.keys();it.hasNext();){String key=it.next();JSONObject value=all.optJSONObject(key);if(value!=null&&value.optString("ownerId").equals(config.optString("ownerId"))&&value.optString("vehicleId").equals(config.optString("vehicleId"))&&!key.equals(address))value.put("enabled",false);}
        all.put(address,config);
        if(!prefs(c).edit().putString("bindings",all.toString()).putString("owner",config.getString("ownerId")).remove("error").commit())throw new IllegalStateException("Unable to persist car association");
    }}
    static void updateBaseline(Context c,String owner,String vehicle,int km)throws JSONException{synchronized(TrackingStore.class){
        JSONObject current=TrackingStore.read(c);if(current.optBoolean("active")&&vehicle.equals(current.optString("vehicleId")))return;
        JSONArray queue=pending(c,owner);for(int i=0;i<queue.length();i++)if(vehicle.equals(queue.getJSONObject(i).optString("vehicleId")))return;
        JSONObject all=bindings(c);for(java.util.Iterator<String> it=all.keys();it.hasNext();){JSONObject value=all.getJSONObject(it.next());if(owner.equals(value.optString("ownerId"))&&vehicle.equals(value.optString("vehicleId")))value.put("baseline",km);}
        prefs(c).edit().putString("bindings",all.toString()).apply();
    }}
    static void suppress(Context c){JSONObject state=TrackingStore.read(c);if(state.optBoolean("automatic"))prefs(c).edit().putBoolean("suppressed-"+state.optString("address"),true).apply();}
    static void disable(Context c,String owner,String vehicle)throws JSONException{synchronized(TrackingStore.class){
        JSONObject all=bindings(c);CompanionDeviceManager manager=Build.VERSION.SDK_INT>=26?c.getSystemService(CompanionDeviceManager.class):null;
        for(java.util.Iterator<String> it=all.keys();it.hasNext();){String address=it.next();JSONObject value=all.getJSONObject(address);if(owner.equals(value.optString("ownerId"))&&(vehicle==null||vehicle.equals(value.optString("vehicleId")))){value.put("enabled",false);if(manager!=null)try{manager.disassociate(address);}catch(Exception ignored){}}}
        prefs(c).edit().putString("bindings",all.toString()).apply();
        JSONObject active=TrackingStore.read(c);
        if(active.optBoolean("automatic")&&active.optBoolean("active")&&owner.equals(active.optString("ownerId"))&&(vehicle==null||vehicle.equals(active.optString("vehicleId")))){TrackingStore.stop(c);c.stopService(new Intent(c,TrackingService.class));TrackingService.running=false;}
        if(vehicle==null&&owner.equals(prefs(c).getString("owner","")))prefs(c).edit().remove("owner").apply();
    }}
    /** Recover a missed broadcast and activate an already-connected, explicitly bound car. */
    static void reconcileConnected(Context context,String owner){
        if(owner==null||owner.isEmpty()||!owner.equals(prefs(context).getString("owner","")))return;
        JSONObject all=bindings(context);
        for(java.util.Iterator<String> it=all.keys();it.hasNext();){
            String address=it.next();JSONObject config=all.optJSONObject(address);
            if(config==null||!config.optBoolean("enabled")||!owner.equals(config.optString("ownerId")))continue;
            CarBluetoothVerifier.verify(context,address,connected->{if(connected)connection(context,address,true);});
        }
    }
    static void connection(Context c,String address,boolean connected){synchronized(TrackingStore.class){
        try{
            if(!CarIdentity.valid(address))return;
            address=address.toUpperCase(java.util.Locale.ROOT);
            JSONObject config=bindings(c).optJSONObject(address);
            if(config==null||!config.optBoolean("enabled")||!CarIdentity.matches(config.optString("address"),address,config.optString("ownerId"),prefs(c).getString("owner",""),config.optString("vehicleId")))return;
            JSONObject state=TrackingStore.read(c);
            if(state.optBoolean("automatic")&&state.optBoolean("active")&&state.optLong("stopAt")>0&&System.currentTimeMillis()>=state.optLong("stopAt")){state=TrackingStore.stop(c);c.stopService(new Intent(c,TrackingService.class));TrackingService.running=false;}
            if(state.optBoolean("active")&&!TrackingService.running){TrackingService.running=true;if(Build.VERSION.SDK_INT>=26)c.startForegroundService(new Intent(c,TrackingService.class));else c.startService(new Intent(c,TrackingService.class));}
            boolean matching=state.optBoolean("automatic")&&config.optString("ownerId").equals(state.optString("ownerId"))&&config.optString("vehicleId").equals(state.optString("vehicleId"))&&address.equalsIgnoreCase(state.optString("address"))&&state.optBoolean("active")&&TrackingService.running;
            if(!connected){prefs(c).edit().remove("suppressed-"+address).apply();if(matching&&state.optLong("stopAt")==0){long now=System.currentTimeMillis();state.put("bluetoothConnected",false).put("stopAt",now+STOP_DELAY).put("disconnectedAt",now).put("disconnectDistance",state.optDouble("distance")).put("disconnectPoints",new JSONArray(state.optJSONArray("points").toString()));TrackingStore.write(c,state);}return;}
            if(matching){if(state.has("disconnectedAt"))state.put("forceBreak",true);state.put("bluetoothConnected",true);state.remove("stopAt");state.remove("disconnectedAt");state.remove("disconnectDistance");state.remove("disconnectPoints");TrackingStore.write(c,state);return;}
            if(prefs(c).getBoolean("suppressed-"+address,false)||TrackingService.running)return;
            if(Build.VERSION.SDK_INT>=29&&c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED){prefs(c).edit().putString("error","Permite localizarea Tot timpul pentru pornire automată.").apply();return;}
            if(pending(c,config.getString("ownerId")).length()>=200){prefs(c).edit().putString("error","Deschide AutoCare pentru a sincroniza traseele.").apply();return;}
            if(state.has("id")&&!state.optBoolean("automatic")){prefs(c).edit().putString("error","Salvează traseul manual înainte de pornirea automată.").apply();return;}
            long now=System.currentTimeMillis();
            JSONObject trip=new JSONObject().put("id",UUID.randomUUID().toString()).put("ownerId",config.getString("ownerId")).put("vehicleId",config.getString("vehicleId")).put("baseline",config.getInt("baseline")).put("startedAt",now).put("updatedAt",now).put("distance",0).put("active",true).put("automatic",true).put("awaitingMotion",true).put("bluetoothConnected",true).put("bluetoothConnectionAt",now).put("address",address).put("points",new JSONArray());
            TrackingStore.write(c,trip);prefs(c).edit().remove("error").apply();TrackingService.running=true;
            if(Build.VERSION.SDK_INT>=26)c.startForegroundService(new Intent(c,TrackingService.class));else c.startService(new Intent(c,TrackingService.class));
        }catch(Exception e){TrackingService.running=false;try{TrackingStore.stop(c);}catch(Exception ignored){}prefs(c).edit().putString("error","Pornirea automată a fost oprită de telefon. Deschide AutoCare.").apply();}
    }}
}
