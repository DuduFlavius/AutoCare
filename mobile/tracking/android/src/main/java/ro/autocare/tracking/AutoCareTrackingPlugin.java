package ro.autocare.tracking;
import android.Manifest;
import android.content.Intent;
import android.location.LocationManager;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;

@CapacitorPlugin(name="AutoCareTracking",permissions={@Permission(alias="location",strings={Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION}),@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class AutoCareTrackingPlugin extends Plugin {
    private boolean owned(PluginCall call,JSONObject state){return call.getString("ownerId","").equals(state.optString("ownerId"));}
    @PluginMethod public void snapshot(PluginCall call){JSONObject state=TrackingStore.forOwner(getContext(),call.getString("ownerId",""));if(!state.has("id")||!owned(call,state)){call.resolve(new JSObject());return;}try{if(state.optBoolean("active")&&!TrackingService.running){state.put("active",false).put("endedAt",state.optLong("updatedAt"));TrackingStore.write(getContext(),state);}call.resolve(new JSObject(state.toString()));}catch(Exception e){call.reject("Invalid saved GPS state",e);}}
    @PluginMethod public void start(PluginCall call){
        if(getPermissionState("location")!=PermissionState.GRANTED){requestPermissionForAlias("location",call,"permissionResult");return;}
        permissionResult(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call){
        if(getPermissionState("location")!=PermissionState.GRANTED){call.reject("Permite locația precisă pentru a porni GPS-ul.");return;}
        if(android.os.Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"notificationResult");return;}
        beginTracking(call);
    }
    @PermissionCallback private void notificationResult(PluginCall call){if(getPermissionState("notifications")!=PermissionState.GRANTED){call.reject("Permite notificările pentru controlul GPS din fundal.");return;}beginTracking(call);}
    private void beginTracking(PluginCall call){
        try{
            LocationManager manager=(LocationManager)getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
            if(!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)){call.reject("Activează GPS-ul telefonului.");return;}
            JSONObject current=TrackingStore.read(getContext());
            if(current.optBoolean("active")&&!TrackingService.running){TrackingStore.stop(getContext());current=TrackingStore.read(getContext());}
            if(current.optBoolean("active")&&!owned(call,current)){call.reject("O altă urmărire este deja activă pe acest dispozitiv.");return;}
            JSONObject existing=TrackingStore.forOwner(getContext(),call.getString("ownerId",""));
            if(existing.has("id")){
                if(!owned(call,existing)||!existing.optString("id").equals(call.getString("id"))){call.reject("Salvează sau șterge traseul existent înainte de altă urmărire.");return;}
                existing.put("active",true);existing.remove("endedAt");TrackingStore.write(getContext(),existing);
            }else{
                String owner=call.getString("ownerId"),vehicle=call.getString("vehicleId"),id=call.getString("id");Integer baseline=call.getInt("baseline");
                if(owner==null||owner.isEmpty()||vehicle==null||id==null||baseline==null||baseline<0){call.reject("Invalid trip");return;}
                TrackingStore.write(getContext(),new JSONObject().put("id",id).put("ownerId",owner).put("vehicleId",vehicle).put("baseline",baseline).put("startedAt",System.currentTimeMillis()).put("updatedAt",System.currentTimeMillis()).put("distance",0).put("active",true).put("points",new JSONArray()));
            }
            TrackingService.running=true;
            if(android.os.Build.VERSION.SDK_INT>=26)getContext().startForegroundService(new Intent(getContext(),TrackingService.class));else getContext().startService(new Intent(getContext(),TrackingService.class));snapshot(call);
        }catch(Exception e){TrackingService.running=false;try{TrackingStore.stop(getContext());}catch(Exception ignored){}call.reject("Nu s-a putut porni urmărirea GPS.",e);}
    }
    @PluginMethod public void stop(PluginCall call){JSONObject state=TrackingStore.read(getContext());if(state.has("id")&&!owned(call,state)){snapshot(call);return;}getContext().stopService(new Intent(getContext(),TrackingService.class));try{TrackingStore.stop(getContext());snapshot(call);}catch(Exception e){call.reject("Unable to stop GPS",e);}}
    @PluginMethod public void clear(PluginCall call){JSONObject state=TrackingStore.forOwner(getContext(),call.getString("ownerId",""));if(state.optBoolean("active")){call.reject("Stop GPS before clearing");return;}try{TrackingStore.clearOwner(getContext(),call.getString("ownerId",""));call.resolve();}catch(Exception e){call.reject("Unable to clear GPS trip",e);}}
}
