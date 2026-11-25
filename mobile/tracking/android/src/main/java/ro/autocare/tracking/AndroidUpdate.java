package ro.autocare.tracking;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import javax.net.ssl.HttpsURLConnection;

final class AndroidUpdate {
    private static final int MAX_BYTES = 64 * 1024 * 1024;

    static URI source(String url, String version) {
        URI uri = URI.create(url);
        if (!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")
            || !"https".equals(uri.getScheme()) || !"www.autocareapp.ro".equals(uri.getRawAuthority())
            || !("/downloads/AutoCare-" + version + ".apk").equals(uri.getRawPath())
            || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("Invalid AutoCare installer URL");
        }
        return uri;
    }

    static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private static Signature[] signers(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28
            ? (info.signingInfo == null ? new Signature[0] : info.signingInfo.getApkContentsSigners())
            : (info.signatures == null ? new Signature[0] : info.signatures);
    }

    static File download(Context context, URI uri, String version, int code) throws Exception {
        PackageManager packages = context.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo installed = packages.getPackageInfo(context.getPackageName(), flags);
        if (versionCode(installed) >= code) throw new IOException("The APK is already installed or older");
        File directory = new File(context.getCacheDir(), "autocare-updates");
        if (!directory.mkdirs() && !directory.isDirectory()) throw new IOException("Update cache unavailable");
        File target = new File(directory, "AutoCare.apk");
        File temporary = File.createTempFile("download-", ".apk", directory);
        HttpsURLConnection connection = null;
        try {
            connection = (HttpsURLConnection) uri.toURL().openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
            if (connection.getResponseCode() != 200 || connection.getContentLength() > MAX_BYTES)
                throw new IOException("Update download unavailable");
            long deadline = android.os.SystemClock.elapsedRealtime() + 120000;
            try (var input = connection.getInputStream(); var output = new FileOutputStream(temporary)) {
                byte[] buffer = new byte[32768];
                int total = 0;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > MAX_BYTES || android.os.SystemClock.elapsedRealtime() > deadline)
                        throw new IOException("Update download exceeded limits");
                    output.write(buffer, 0, count);
                }
            }
            PackageInfo update = packages.getPackageArchiveInfo(temporary.getAbsolutePath(), flags);
            if (update == null || !installed.packageName.equals(update.packageName)
                || versionCode(update) != code || !version.equals(update.versionName)
                || signers(update).length == 0 || !new HashSet<>(Arrays.asList(signers(installed)))
                    .equals(new HashSet<>(Arrays.asList(signers(update)))))
                throw new IOException("APK identity or signing certificate mismatch");
            if (!temporary.renameTo(target)) throw new IOException("Could not open downloaded installer");
            return target;
        } finally {
            if (connection != null) connection.disconnect();
            temporary.delete();
        }
    }

    static Intent installer(Context context, File apk) {
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
        return new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }
}
