package ro.autocare.tracking;
import android.bluetooth.*;
import android.content.*;
/** Profile events cover cars whose audio connects after the ACL broadcast. */
public class CarConnectionReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  String action=intent.getAction();
  boolean acl=BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)||BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action);
  boolean profile=BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED.equals(action)||BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED.equals(action);
  if(!acl&&!profile)return;
  BluetoothDevice device=intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);if(device==null)return;
  try{
   String address=device.getAddress();
   // A real ACL disconnect ends the link. A profile disconnect may leave another profile active.
   if(BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)){AutoDrive.connection(context,address,false);return;}
   int state=intent.getIntExtra(BluetoothProfile.EXTRA_STATE,-1);
   if(profile&&state!=BluetoothProfile.STATE_CONNECTED&&state!=BluetoothProfile.STATE_DISCONNECTED)return;
   PendingResult pending=goAsync();
   CarBluetoothVerifier.verify(context,address,connected->{try{AutoDrive.connection(context,address,connected);}finally{pending.finish();}});
  }catch(SecurityException ignored){}
 }
}
