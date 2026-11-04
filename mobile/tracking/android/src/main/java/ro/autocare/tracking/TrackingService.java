package ro.autocare.tracking;
import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;

public class TrackingService extends Service implements LocationListener {
    static volatile boolean running=false;
    static final String STOP="ro.autocare.tracking.STOP";
    private LocationManager manager;
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null && STOP.equals(intent.getAction())){stopTracking();return START_NOT_STICKY;}
        if(!TrackingStore.read(this).optBoolean("active")){stopSelf();return START_NOT_STICKY;}
        running=true;
        try {
            NotificationManager notifications=getSystemService(NotificationManager.class);
            notifications.createNotificationChannel(new NotificationChannel("autocare-gps","AutoCare GPS",NotificationManager.IMPORTANCE_LOW));
            PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,TrackingService.class).setAction(STOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
            Notification.Builder notification=new Notification.Builder(this,"autocare-gps").setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("AutoCare · GPS activ").setContentText("Înregistrare traseu · apasă Oprește GPS la final").setOngoing(true).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause,"Oprește GPS",stop).build());
            if(launch!=null)notification.setContentIntent(PendingIntent.getActivity(this,0,launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
            startForeground(317,notification.build());
            manager=(LocationManager)getSystemService(LOCATION_SERVICE);
            if(!manager.isProviderEnabled(LocationManager.GPS_PROVIDER))throw new IllegalStateException("GPS disabled");
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000L,0f,this,Looper.getMainLooper());
            return START_NOT_STICKY;
        } catch(Exception e){stopTracking();return START_NOT_STICKY;}
    }
    private void stopTracking(){running=false;try{TrackingStore.stop(this);}catch(Exception ignored){}if(manager!=null)manager.removeUpdates(this);stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    @Override public void onLocationChanged(Location location){try{TrackingStore.append(this,location);}catch(Exception e){stopTracking();}}
    @Override public void onProviderDisabled(String provider){stopTracking();}
    @Override public void onDestroy(){running=false;if(manager!=null)manager.removeUpdates(this);try{TrackingStore.stop(this);}catch(Exception ignored){}super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
