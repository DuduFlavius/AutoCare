package ro.autocare.tracking;
import android.bluetooth.*;
import android.content.Context;
import android.os.*;
import java.util.concurrent.atomic.*;
/** Exact live A2DP/Headset connection, never proximity or a saved pairing. */
final class CarBluetoothVerifier {
 interface Result{void accept(boolean connected);}
 static void verify(Context context,String address,Result callback){
  AtomicBoolean complete=new AtomicBoolean();AtomicInteger remaining=new AtomicInteger(2);
  Handler handler=new Handler(Looper.getMainLooper());
  Result finish=connected->{if(connected||remaining.decrementAndGet()==0)if(complete.compareAndSet(false,true))callback.accept(connected);};
  handler.postDelayed(()->{if(complete.compareAndSet(false,true))callback.accept(false);},5000);
  try{
   BluetoothManager manager=context.getSystemService(BluetoothManager.class);BluetoothAdapter adapter=manager==null?null:manager.getAdapter();
   if(adapter==null||!adapter.isEnabled()){if(complete.compareAndSet(false,true))callback.accept(false);return;}
   for(int profile:new int[]{BluetoothProfile.A2DP,BluetoothProfile.HEADSET}){
    boolean requested=adapter.getProfileProxy(context,new BluetoothProfile.ServiceListener(){
     @Override public void onServiceConnected(int type,BluetoothProfile proxy){boolean found=false;try{for(BluetoothDevice device:proxy.getConnectedDevices())if(address.equalsIgnoreCase(device.getAddress()))found=true;}catch(SecurityException ignored){}finally{adapter.closeProfileProxy(type,proxy);}finish.accept(found);}
     @Override public void onServiceDisconnected(int type){}
    },profile);
    if(!requested)finish.accept(false);
   }
  }catch(Exception error){if(complete.compareAndSet(false,true))callback.accept(false);}
 }
}
