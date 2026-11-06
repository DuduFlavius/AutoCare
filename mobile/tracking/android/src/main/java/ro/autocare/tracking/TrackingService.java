package ro.autocare.tracking;
import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;

public class TrackingService extends Service implements LocationListener {
    static volatile boolean running=false;
    static final String STOP="ro.autocare.tracking.STOP";
    private LocationManager manager;
    private long lastBluetoothCheck=0;
    private void verifyCar(){
        org.json.JSONObject state=TrackingStore.read(this);
        if(!state.optBoolean("automatic")||!state.optBoolean("active"))return;
        String id=state.optString("id"),address=state.optString("address");
        CarBluetoothVerifier.verify(this,address,connected->{
            org.json.JSONObject current=TrackingStore.read(this);
            if(!id.equals(current.optString("id"))||!current.optBoolean("active"))return;
            if(!connected){stopTracking();return;}
            try{current.put("bluetoothConnected",true);TrackingStore.write(this,current);}catch(Exception ignored){stopTracking();}
        });
    }
    private final Handler clock=new Handler(Looper.getMainLooper());
    private final Runnable deadline=new Runnable(){public void run(){long at=TrackingStore.read(TrackingService.this).optLong("stopAt");if(at>0&&System.currentTimeMillis()>=at){stopTracking();return;}if(System.currentTimeMillis()-lastBluetoothCheck>10000){lastBluetoothCheck=System.currentTimeMillis();verifyCar();}clock.postDelayed(this,2000);}};
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null && STOP.equals(intent.getAction())){AutoDrive.suppress(this);stopTracking();return START_NOT_STICKY;}
        if(!TrackingStore.read(this).optBoolean("active")){stopSelf();return START_NOT_STICKY;}
        running=true;
        org.json.JSONObject recovered=TrackingStore.read(this);
        if(recovered.optBoolean("automatic")&&System.currentTimeMillis()-recovered.optLong("bluetoothConnectionAt")>5000){
            try{recovered.put("bluetoothConnected",false).put("forceBreak",true);TrackingStore.write(this,recovered);}catch(Exception ignored){stopTracking();return START_NOT_STICKY;}
            verifyCar();
        }
        lastBluetoothCheck=System.currentTimeMillis();
        try {
            NotificationManager notifications=getSystemService(NotificationManager.class);
            if(Build.VERSION.SDK_INT>=26)notifications.createNotificationChannel(new NotificationChannel("autocare-gps","AutoCare GPS",NotificationManager.IMPORTANCE_LOW));
            PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,TrackingService.class).setAction(STOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
            Notification.Builder notification=(Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"autocare-gps"):new Notification.Builder(this)).setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("AutoCare · GPS activ").setContentText("Înregistrare traseu · apasă Oprește GPS la final").setOngoing(true).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause,"Oprește GPS",stop).build());
            if(launch!=null)notification.setContentIntent(PendingIntent.getActivity(this,0,launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
            startForeground(317,notification.build());
            manager=(LocationManager)getSystemService(LOCATION_SERVICE);
            if(!manager.isProviderEnabled(LocationManager.GPS_PROVIDER))throw new IllegalStateException("GPS disabled");
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000L,0f,this,Looper.getMainLooper());
            clock.removeCallbacks(deadline);clock.postDelayed(deadline,2000);
            return START_STICKY;
        } catch(Exception e){stopTracking();return START_NOT_STICKY;}
    }
    private void stopTracking(){clock.removeCallbacks(deadline);running=false;try{TrackingStore.stop(this);}catch(Exception ignored){}if(manager!=null)manager.removeUpdates(this);stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    @Override public void onLocationChanged(Location location){try{TrackingStore.append(this,location);}catch(Exception e){stopTracking();}}
    @Override public void onProviderDisabled(String provider){stopTracking();}
    @Override public void onDestroy(){clock.removeCallbacks(deadline);running=false;if(manager!=null)manager.removeUpdates(this);// Lifecycle cleanup must not finalize a trip: Android may recreate this sticky service.
        super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
