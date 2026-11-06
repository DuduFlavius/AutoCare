package ro.autocare.garage;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState){
  super.onCreate(savedInstanceState);
  if(getBridge()!=null&&getBridge().getWebView()!=null){
   android.webkit.WebSettings settings=getBridge().getWebView().getSettings();
   settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);
  }
 }
}
