package ro.autocare.garage;
import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState){
  if (BuildConfig.PLAY_DISTRIBUTION) registerPlugin(AutoCareBillingPlugin.class);
  super.onCreate(savedInstanceState);
  if(getBridge()!=null&&getBridge().getWebView()!=null){
   getBridge().getWebView().setBackgroundColor(android.graphics.Color.rgb(246,249,251));
   android.webkit.WebSettings settings=getBridge().getWebView().getSettings();
   settings.setTextZoom(100);settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);
  }
  openAppLink(getIntent());
 }
 @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);openAppLink(intent);}
 private void openAppLink(Intent intent){
  if(intent==null||!Intent.ACTION_VIEW.equals(intent.getAction()))return;
  String target=AppLinkTarget.destination(intent.getDataString());
  if(target!=null&&getBridge()!=null&&getBridge().getWebView()!=null)getBridge().getWebView().post(()->getBridge().getWebView().loadUrl(target));
 }
}
