package ro.autocare.tracking;
import android.Manifest;
import android.app.Activity;
import android.bluetooth.*;
import android.companion.*;
import android.net.Uri;
import android.os.*;
import android.content.pm.PackageManager;
import androidx.activity.result.*;
import androidx.activity.result.contract.ActivityResultContracts;
import android.content.Intent;
import android.location.LocationManager;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;

@CapacitorPlugin(name="AutoCareTracking",permissions={@Permission(alias="location",strings={Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION}),@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS}),@Permission(alias="bluetooth",strings={Manifest.permission.BLUETOOTH_CONNECT})})
public class AutoCareTrackingPlugin extends Plugin {
    @PluginMethod public void appVersion(PluginCall call){
        try{android.content.pm.PackageInfo info=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);JSObject value=new JSObject();value.put("version",info.versionName);value.put("versionCode",Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode);call.resolve(value);}catch(Exception e){call.reject("Unable to read app version",e);}
    }
    @PluginMethod public void openAndroidUpdate(PluginCall call){
        try{if(TrackingStore.read(getContext()).optBoolean("active")){call.reject("Stop and save GPS before installing an update");return;}Uri uri=Uri.parse(call.getString("url",""));if(!"https".equals(uri.getScheme())||!"project-sxage.vercel.app".equals(uri.getHost())||uri.getPath()==null||!uri.getPath().matches("/downloads/AutoCare-[0-9.]+\\.apk")){call.reject("Invalid update URL");return;}getActivity().startActivity(new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE));call.resolve();}catch(Exception e){call.reject("Unable to open Android installer",e);}
    }
    private PluginCall pairing;
    private ActivityResultLauncher<IntentSenderRequest> chooser;
    private boolean owned(PluginCall call,JSONObject state){return call.getString("ownerId","").equals(state.optString("ownerId"));}
    @PluginMethod public void snapshot(PluginCall call){JSONObject state=TrackingStore.forOwner(getContext(),call.getString("ownerId",""));if(!state.has("id")||!owned(call,state)){call.resolve(new JSObject());return;}try{if(state.optBoolean("active")&&!TrackingService.running){if(Build.VERSION.SDK_INT>=26)getContext().startForegroundService(new Intent(getContext(),TrackingService.class));else getContext().startService(new Intent(getContext(),TrackingService.class));}call.resolve(new JSObject(state.toString()));}catch(Exception e){call.reject("Invalid saved GPS state",e);}}
    private boolean locationDisclosure(PluginCall call,boolean automation) {
        if(getContext().getSharedPreferences("autocare-location-consent",0).getBoolean("disclosed-v1",false))return true;
        getActivity().runOnUiThread(() -> {
            boolean en=getContext().getResources().getConfiguration().getLocales().get(0).getLanguage().equals("en");
            new android.app.AlertDialog.Builder(getActivity())
              .setTitle(en?"Location in the background":"Localizarea în fundal")
              .setMessage(en?"AutoCare collects location data to record your route, calculate driving distance and run AutoDrive, even when the app is closed or not in use. Tracking starts only when you press Start GPS or enable AutoDrive for your car. Route coordinates stay on this device; distance and trip times sync to your account when the app is reopened. You can stop GPS from the app or its notification and disable AutoDrive. Location is not used for advertising.":"AutoCare colectează date de locație pentru înregistrarea traseului, calcularea distanței și AutoDrive, inclusiv când aplicația este închisă sau nu este utilizată. Urmărirea pornește doar când apeși Pornește GPS sau activezi AutoDrive pentru mașina ta. Coordonatele traseului rămân pe dispozitiv; distanța și orele călătoriei se sincronizează în cont când redeschizi aplicația. Poți opri GPS-ul din aplicație sau notificare și poți dezactiva AutoDrive. Locația nu este folosită pentru publicitate.")
              .setPositiveButton(en?"Continue":"Continuă",(dialog,which)->{
                getContext().getSharedPreferences("autocare-location-consent",0).edit().putBoolean("disclosed-v1",true).apply();
                if(automation)configureAutomation(call);else start(call);
              })
              .setNegativeButton(en?"Not now":"Nu acum",(dialog,which)->call.reject(en?"Location setup cancelled.":"Configurarea locației a fost anulată.","LOCATION_CONSENT_CANCELLED"))
              .setOnCancelListener(dialog->call.reject("Location setup cancelled.","LOCATION_CONSENT_CANCELLED"))
              .show();
        });
        return false;
    }
    @PluginMethod public void start(PluginCall call){
        if(!locationDisclosure(call,false))return;
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

            if(current.optBoolean("active")&&!owned(call,current)){call.reject("O altă urmărire este deja activă pe acest dispozitiv.");return;}
            JSONObject existing=TrackingStore.forOwner(getContext(),call.getString("ownerId",""));
            if(existing.optBoolean("automatic")&&!existing.optBoolean("active")){call.reject("Traseul automat așteaptă sincronizarea. Deschide AutoDrive.");return;}
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
    @PluginMethod public void stop(PluginCall call){JSONObject state=TrackingStore.read(getContext());if(owned(call,state))AutoDrive.suppress(getContext());if(state.has("id")&&!owned(call,state)){snapshot(call);return;}try{TrackingStore.stop(getContext());getContext().stopService(new Intent(getContext(),TrackingService.class));snapshot(call);}catch(Exception e){call.reject("Unable to stop GPS",e);}}
    @PluginMethod public void clear(PluginCall call){JSONObject state=TrackingStore.forOwner(getContext(),call.getString("ownerId",""));if(state.optBoolean("active")){call.reject("Stop GPS before clearing");return;}try{TrackingStore.clearOwner(getContext(),call.getString("ownerId",""));call.resolve();}catch(Exception e){call.reject("Unable to clear GPS trip",e);}}

    @PluginMethod public void automationStatus(PluginCall call){
        try{String owner=call.getString("ownerId","");JSONArray list=new JSONArray();JSONObject all=AutoDrive.bindings(getContext());for(java.util.Iterator<String> it=all.keys();it.hasNext();){JSONObject row=all.getJSONObject(it.next());if(owner.equals(row.optString("ownerId")))list.put(row);}
            JSObject result=new JSObject();result.put("apiVersion",2);result.put("platform","android");result.put("supported",Build.VERSION.SDK_INT>=26);result.put("bindings",list);result.put("pendingCount",AutoDrive.pending(getContext(),owner).length());result.put("backgroundLocation",Build.VERSION.SDK_INT<29||getContext().checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED);result.put("error",AutoDrive.prefs(getContext()).getString("error",""));call.resolve(result);
        }catch(Exception e){call.reject("Unable to read automation status",e);}
    }
    @PluginMethod public void pairedDevices(PluginCall call){if(Build.VERSION.SDK_INT>=31&&getPermissionState("bluetooth")!=PermissionState.GRANTED){requestPermissionForAlias("bluetooth",call,"pairedPermission");return;}listDevices(call);}
    @PermissionCallback private void pairedPermission(PluginCall call){if(getPermissionState("bluetooth")!=PermissionState.GRANTED){call.reject("Permite accesul la dispozitivele Bluetooth.");return;}listDevices(call);}
    private void listDevices(PluginCall call){try{BluetoothManager manager=getContext().getSystemService(BluetoothManager.class);BluetoothAdapter adapter=manager.getAdapter();JSONArray list=new JSONArray();if(adapter!=null&&adapter.isEnabled())for(BluetoothDevice device:adapter.getBondedDevices())list.put(new JSONObject().put("name",device.getName()==null?"Bluetooth":device.getName()).put("address",device.getAddress()));JSObject out=new JSObject();out.put("devices",list);call.resolve(out);}catch(Exception e){call.reject("Unable to list paired devices",e);}}
    @PluginMethod public void openLocationSettings(PluginCall call){Intent intent=new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName()));getActivity().startActivity(intent);call.resolve();}
    @PluginMethod public void configureAutomation(PluginCall call){
        if(!locationDisclosure(call,true))return;
        if(Build.VERSION.SDK_INT<26){call.reject("Pornirea automată necesită Android 8 sau mai nou.");return;}
        if(getPermissionState("location")!=PermissionState.GRANTED){requestPermissionForAlias("location",call,"autoLocation");return;}
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"autoNotifications");return;}
        if(Build.VERSION.SDK_INT>=31&&getPermissionState("bluetooth")!=PermissionState.GRANTED){requestPermissionForAlias("bluetooth",call,"autoBluetooth");return;}
        if(Build.VERSION.SDK_INT>=29&&getContext().checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED){call.reject("Permite localizarea Tot timpul din setările aplicației, apoi reîncearcă.","BACKGROUND_PERMISSION_REQUIRED");return;}
        if(pairing!=null){call.reject("Asocierea Bluetooth este deja în curs.");return;}
        try{String address=call.getString("address","");BluetoothManager bluetooth=getContext().getSystemService(BluetoothManager.class);boolean bonded=false;for(BluetoothDevice device:bluetooth.getAdapter().getBondedDevices())if(address.equals(device.getAddress()))bonded=true;
            if(!bonded||call.getString("ownerId","").isEmpty()||call.getString("vehicleId","").isEmpty()||call.getInt("baseline",-1)<0){call.reject("Selectează mașina și Bluetooth-ul ei din lista de dispozitive asociate.");return;}
            CompanionDeviceManager manager=getContext().getSystemService(CompanionDeviceManager.class);
            if(manager.getAssociations().contains(address)){saveAssociation(call);return;}
            pairing=call;
            if(chooser==null)chooser=getActivity().getActivityResultRegistry().register("autocare-car-association",new ActivityResultContracts.StartIntentSenderForResult(),result->{PluginCall pending=pairing;pairing=null;if(pending==null)return;if(result.getResultCode()==Activity.RESULT_OK)saveAssociation(pending);else pending.reject("Asocierea Bluetooth a fost anulată.");});
            AssociationRequest request=new AssociationRequest.Builder().addDeviceFilter(new BluetoothDeviceFilter.Builder().setAddress(address).build()).setSingleDevice(true).build();
            manager.associate(request,new CompanionDeviceManager.Callback(){@Override public void onDeviceFound(android.content.IntentSender sender){getActivity().runOnUiThread(()->chooser.launch(new IntentSenderRequest.Builder(sender).build()));}@Override public void onFailure(CharSequence reason){pairing=null;call.reject("Asocierea Bluetooth nu a reușit.");}},new Handler(Looper.getMainLooper()));
        }catch(Exception e){pairing=null;call.reject("Asocierea Bluetooth nu a reușit.",e);}
    }
    @PermissionCallback private void autoLocation(PluginCall call){if(getPermissionState("location")!=PermissionState.GRANTED){call.reject("Permite localizarea precisă.");return;}configureAutomation(call);}
    @PermissionCallback private void autoNotifications(PluginCall call){if(getPermissionState("notifications")!=PermissionState.GRANTED){call.reject("Permite notificările GPS.");return;}configureAutomation(call);}
    @PermissionCallback private void autoBluetooth(PluginCall call){if(getPermissionState("bluetooth")!=PermissionState.GRANTED){call.reject("Permite accesul Bluetooth.");return;}configureAutomation(call);}
    private void saveAssociation(PluginCall call){try{AutoDrive.configure(getContext(),new JSONObject().put("ownerId",call.getString("ownerId")).put("vehicleId",call.getString("vehicleId")).put("vehicleName",call.getString("vehicleName","")).put("baseline",call.getInt("baseline")).put("address",call.getString("address")).put("enabled",true));automationStatus(call);}catch(Exception e){call.reject("Nu s-a putut salva asocierea.",e);}}
    @PluginMethod public void disableAutomation(PluginCall call){try{AutoDrive.disable(getContext(),call.getString("ownerId",""),call.getString("vehicleId"));call.resolve();}catch(Exception e){call.reject("Unable to disable automatic tracking",e);}}
    @PluginMethod public void pendingTrips(PluginCall call){JSObject result=new JSObject();result.put("trips",AutoDrive.pending(getContext(),call.getString("ownerId","")));call.resolve(result);}
    @PluginMethod public void acknowledgeTrips(PluginCall call){try{AutoDrive.acknowledge(getContext(),call.getString("ownerId",""),call.getArray("ids",new JSArray()));call.resolve();}catch(Exception e){call.reject("Unable to confirm GPS sync",e);}}
    @PluginMethod public void updateAutomationVehicle(PluginCall call){try{AutoDrive.updateBaseline(getContext(),call.getString("ownerId",""),call.getString("vehicleId",""),call.getInt("baseline",0));call.resolve();}catch(Exception e){call.reject("Unable to refresh vehicle mileage",e);}}
    @Override protected void handleOnDestroy(){if(chooser!=null)chooser.unregister();if(pairing!=null){pairing.reject("Asocierea a fost întreruptă.");pairing=null;}}
}
