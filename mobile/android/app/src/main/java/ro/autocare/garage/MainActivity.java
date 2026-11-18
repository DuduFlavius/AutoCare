package ro.autocare.garage;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState){
  if (BuildConfig.PLAY_DISTRIBUTION) registerPlugin(AutoCareBillingPlugin.class);
  super.onCreate(savedInstanceState);
  if(getBridge()!=null&&getBridge().getWebView()!=null){
   android.webkit.WebSettings settings=getBridge().getWebView().getSettings();
   settings.setTextZoom(100);settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);
  }
 }
}
