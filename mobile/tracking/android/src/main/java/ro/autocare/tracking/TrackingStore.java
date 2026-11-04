package ro.autocare.tracking;
import android.content.Context;
import android.location.Location;
import org.json.*;

final class TrackingStore {
    private static final String KEY="trip-v1";
    static synchronized JSONObject read(Context context) {
        try { return new JSONObject(context.getSharedPreferences("autocare-gps",Context.MODE_PRIVATE).getString(KEY,"{}")).put("lastFixAt",context.getSharedPreferences("autocare-gps",Context.MODE_PRIVATE).getLong("fix-at",0)); }
        catch(Exception e){ return new JSONObject(); }
    }
    static synchronized JSONObject forOwner(Context context,String owner) {
        JSONObject current=read(context);if(owner.equals(current.optString("ownerId")))return current;
        try{return new JSONObject(context.getSharedPreferences("autocare-gps",Context.MODE_PRIVATE).getString("owner-v1-"+owner,"{}"));}catch(Exception e){return new JSONObject();}
    }
    static synchronized void clearOwner(Context context,String owner){
        android.content.SharedPreferences.Editor edit=context.getSharedPreferences("autocare-gps",Context.MODE_PRIVATE).edit().remove("owner-v1-"+owner);
        if(owner.equals(read(context).optString("ownerId")))edit.remove(KEY);
        if(!edit.commit())throw new IllegalStateException("Unable to clear GPS trip");
    }
    static synchronized void write(Context context,JSONObject value) {
        // Persist native state before returning; no WebView or backend session is needed.
        android.content.SharedPreferences.Editor edit=context.getSharedPreferences("autocare-gps",Context.MODE_PRIVATE).edit().putString(KEY,value.toString());
        if(value.has("ownerId"))edit.putString("owner-v1-"+value.optString("ownerId"),value.toString());
        if(!edit.commit()) throw new IllegalStateException("Unable to persist GPS trip");
    }
    static synchronized void append(Context context,Location location) throws JSONException {
        JSONObject state=read(context);
        long now=System.currentTimeMillis();
        if(!state.optBoolean("active") || !location.hasAccuracy() || location.getAccuracy()<0 || location.getAccuracy()>50 || location.getTime()>now+5000 || now-location.getTime()>15000)return;
        context.getSharedPreferences("autocare-gps",Context.MODE_PRIVATE).edit().putLong("fix-at",now).apply();
        JSONArray points=state.optJSONArray("points");if(points==null)points=new JSONArray();
        JSONObject previous=points.length()>0?points.getJSONObject(points.length()-1):null;
        boolean gap=previous==null; double meters=0;
        if(previous!=null){
            double seconds=(location.getTime()-previous.getDouble("timestamp"))/1000;
            if(seconds<=0)return;
            gap=seconds>45;
            if(!gap){
                float[] distance=new float[1];Location.distanceBetween(previous.getDouble("latitude"),previous.getDouble("longitude"),location.getLatitude(),location.getLongitude(),distance);
                meters=distance[0];
                if((location.hasSpeed()&&(location.getSpeed()<0.7||location.getSpeed()>55)) || meters/seconds>55 || meters<Math.max(8,Math.min(35,previous.getDouble("accuracy")+location.getAccuracy())))return;
            }
        }
        JSONObject point=new JSONObject().put("latitude",location.getLatitude()).put("longitude",location.getLongitude()).put("accuracy",location.getAccuracy()).put("timestamp",location.getTime()).put("breakBefore",gap);
        if(points.length()>=1500){JSONArray recent=new JSONArray();for(int i=1;i<points.length();i++)recent.put(points.get(i));points=recent;}
        points.put(point);state.put("points",points).put("distance",state.optDouble("distance")+(gap?0:meters)).put("updatedAt",now);
        write(context,state);
    }
    static synchronized JSONObject stop(Context context) throws JSONException {
        JSONObject value=read(context);
        if(value.has("id")){if(value.optBoolean("active"))value.put("endedAt",System.currentTimeMillis());value.put("active",false).put("updatedAt",System.currentTimeMillis());AutoDrive.enqueue(context,value);}
        write(context,value);return value;
    }
}
