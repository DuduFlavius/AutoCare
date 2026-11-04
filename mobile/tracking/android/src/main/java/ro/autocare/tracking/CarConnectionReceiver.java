package ro.autocare.tracking;
import android.bluetooth.BluetoothDevice;
import android.content.*;
public class CarConnectionReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  String action=intent.getAction();if(!BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)&&!BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action))return;
  BluetoothDevice device=intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);if(device==null)return;
  try{AutoDrive.connection(context,device.getAddress(),BluetoothDevice.ACTION_ACL_CONNECTED.equals(action));}catch(SecurityException ignored){}
 }
}
