package ro.autocare.tracking;

import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import org.json.*;

public final class NavigationService extends Service implements LocationListener {
    private static final String STOP = "ro.autocare.tracking.NAVIGATION_STOP";
    private static final int NOTIFICATION = 318;
    static volatile Session session;

    static final class Session {
        final String owner;
        final String destination;
        final NavigationProgress.Step[] steps;
        final boolean english;
        volatile Location lastPosition;
        int step;

        Session(String owner, String destination, NavigationProgress.Step[] steps, boolean english) {
            this.owner = owner;
            this.destination = destination;
            this.steps = steps;
            this.english = english;
        }
    }

    private LocationManager locations;
    private Notification.Builder notification;
    private String lastMessage = "";
    private Session shown;

    static void stop(Context context, String owner) {
        Session current = session;
        if (current != null && current.owner.equals(owner)) {
            session = null;
            context.stopService(new Intent(context, NavigationService.class));
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int id) {
        if (intent != null && STOP.equals(intent.getAction())) {
            stopGuidance();
            return START_NOT_STICKY;
        }
        Session current = session;
        if (current == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            NotificationManager notifications = getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(new NotificationChannel(
                "autocare-navigation", "AutoCare Navigation", NotificationManager.IMPORTANCE_LOW));
            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            PendingIntent stop = PendingIntent.getService(this, NOTIFICATION,
                new Intent(this, NavigationService.class).setAction(STOP), pendingFlags);
            notification = (Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "autocare-navigation") : new Notification.Builder(this))
                .setSmallIcon(android.R.drawable.ic_menu_directions)
                .setContentTitle(current.destination)
                .setContentText(current.english ? "Waiting for GPS" : "Se caută GPS")
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause,
                    current.english ? "Stop guidance" : "Oprește ghidarea", stop).build());
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) notification.setContentIntent(PendingIntent.getActivity(this, NOTIFICATION, launch, pendingFlags));
            startForeground(NOTIFICATION, notification.build());
            shown = current;
            lastMessage = "";
            locations = getSystemService(LocationManager.class);
            locations.removeUpdates(this);
            locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper());
        } catch (RuntimeException failure) {
            stopGuidance();
        }
        return START_NOT_STICKY;
    }

    @Override public void onLocationChanged(Location location) {
        Session current = session;
        if (current == null || current != shown) return;
        current.lastPosition = new Location(location);
        if (!location.hasAccuracy() || location.getAccuracy() > 50) {
            update(current.english ? "Waiting for accurate GPS" : "Se așteaptă un semnal GPS precis");
            return;
        }
        NavigationProgress.Result progress = NavigationProgress.at(current.steps, current.step, location.getLatitude(), location.getLongitude());
        if (progress.gap() > Math.max(65, location.getAccuracy() * 2)) {
            update(current.english ? "Off route. Open AutoCare to reroute." : "Ai ieșit de pe traseu. Deschide AutoCare pentru recalculare.");
            return;
        }
        if (progress.gap() < 40) current.step = progress.step();
        if (progress.remaining() < 35 && progress.gap() < 30) {
            update(current.english ? "You arrived" : "Ai ajuns");
            locations.removeUpdates(this);
            return;
        }
        String instruction = progress.next().isEmpty() ? (current.english ? "Continue to destination" : "Continuă spre destinație") : progress.next();
        update(instruction + " · " + (Math.round(progress.untilTurn() / 10) * 10) + " m");
    }

    private void update(String message) {
        if (message.equals(lastMessage)) return;
        lastMessage = message;
        notification.setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message));
        getSystemService(NotificationManager.class).notify(NOTIFICATION, notification.build());
    }

    @Override public void onProviderDisabled(String provider) {
        if (shown != null && notification != null) update(shown.english ? "GPS is turned off" : "GPS-ul este oprit");
    }

    private void stopGuidance() {
        session = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() {
        if (session == shown) session = null;
        if (locations != null) locations.removeUpdates(this);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
