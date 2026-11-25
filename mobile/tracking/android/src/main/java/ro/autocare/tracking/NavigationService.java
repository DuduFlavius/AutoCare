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
    static NavigationService running; // Accessed on the main thread.
    private NavigationVoice voice;
    private String announced = "";
    private int announcedStep = -1;
    private int announcedDistance = Integer.MAX_VALUE;

    static final class Session {
        final String owner;
        final String destination;
        final NavigationProgress.Step[] steps;
        final boolean english;
        volatile Location lastPosition;
        int step;
        volatile boolean muted = true;

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
            if (voice == null || (shown != null && shown.english != current.english)) {
                if (voice != null) voice.close();
                voice = new NavigationVoice(this, current.english);
            } else voice.stop();
            running = this;
            if (shown == null || !shown.destination.equals(current.destination)) {
                announced = "";
                announcedStep = -1;
                announcedDistance = Integer.MAX_VALUE;
            }
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
        long age = SystemClock.elapsedRealtimeNanos() - location.getElapsedRealtimeNanos();
        if (!location.hasAccuracy() || location.getAccuracy() > 50 || age < 0 || age > 8_000_000_000L) {
            if (voice != null) voice.stop();
            update(current.english ? "Waiting for accurate GPS" : "Se așteaptă un semnal GPS precis");
            return;
        }
        NavigationProgress.Result progress = NavigationProgress.at(current.steps, current.step, location.getLatitude(), location.getLongitude());
        if (progress.gap() > Math.max(65, location.getAccuracy() * 2)) {
            if (voice != null) voice.stop();
            update(current.english ? "Off route. Open AutoCare to reroute." : "Ai ieșit de pe traseu. Deschide AutoCare pentru recalculare.");
            return;
        }
        if (progress.gap() < 40) current.step = progress.step();
        if (progress.remaining() < 35 && progress.gap() < 30) {
            update(current.english ? "You arrived" : "Ai ajuns");
            announce(current, "arrival:" + current.destination, current.english ? "You have arrived." : "Ai ajuns la destinație.");
            return;
        }
        String instruction = progress.next().isEmpty() ? (current.english ? "Continue to destination" : "Continuă spre destinație") : progress.next();
        if (announcedStep != current.step) {
            if (voice != null) voice.stop();
            announcedStep = current.step;
            announcedDistance = Integer.MAX_VALUE;
        }
        int meters = progress.untilTurn() <= 45 ? 0 : progress.untilTurn() <= 220 ? 200 : progress.untilTurn() <= 520 ? 500 : -1;
        if (meters >= 0 && meters < announcedDistance && !progress.next().isEmpty()) {
            String sentence = meters == 0 ? instruction : (current.english ? "In " : "Peste ") + meters
                + (current.english ? " meters, " : " de metri, ") + instruction;
            if (announce(current, current.destination + ":" + current.step + ":" + instruction + ":" + meters, sentence)) announcedDistance = meters;
        }
        update(instruction + " · " + (Math.round(progress.untilTurn() / 10) * 10) + " m");
    }

    private boolean announce(Session current, String key, String sentence) {
        if (current.muted || announced.equals(key) || voice == null || !voice.speak(sentence)) return false;
        announced = key;
        return true;
    }

    boolean setAudio(Session current, boolean muted, boolean test) {
        if (shown != current || voice == null) return false;
        current.muted = muted;
        if (muted) voice.stop();
        return !test || voice.speak(current.english ? "AutoCare voice guidance is ready." : "Ghidarea vocală AutoCare este pregătită.");
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
        if (running == this) running = null;
        if (voice != null) voice.close();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
