import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
// Compile the actual receiver against small Android API stubs and drive its callbacks.
test('Android handles profile-only connections, partial disconnects and real link loss without accepting unrelated broadcasts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'autocare-receiver-'));
 const files:Record<string,string>={
  'android/content/Context.java':'package android.content; public class Context {}',
  'android/content/Intent.java':`package android.content; public class Intent {String action; Object device; int state; public Intent(String a,Object d,int s){action=a;device=d;state=s;} public String getAction(){return action;} @SuppressWarnings("unchecked") public <T> T getParcelableExtra(String k){return (T)device;} public int getIntExtra(String k,int fallback){return state;}}`,
  'android/content/BroadcastReceiver.java':`package android.content; public abstract class BroadcastReceiver { public static int finishes; public static class PendingResult { public void finish(){finishes++;} } public PendingResult goAsync(){return new PendingResult();} public abstract void onReceive(Context c,Intent i);}`,
  'android/bluetooth/BluetoothDevice.java':`package android.bluetooth; public class BluetoothDevice {public static final String ACTION_ACL_CONNECTED="acl+",ACTION_ACL_DISCONNECTED="acl-",EXTRA_DEVICE="device";public String getAddress(){return "AA:BB:CC:DD:EE:FF";}}`,
  'android/bluetooth/BluetoothA2dp.java':'package android.bluetooth; public class BluetoothA2dp {public static final String ACTION_CONNECTION_STATE_CHANGED="audio";}',
  'android/bluetooth/BluetoothHeadset.java':'package android.bluetooth; public class BluetoothHeadset {public static final String ACTION_CONNECTION_STATE_CHANGED="headset";}',
  'android/bluetooth/BluetoothProfile.java':'package android.bluetooth; public interface BluetoothProfile {String EXTRA_STATE="state";int STATE_CONNECTED=2,STATE_DISCONNECTED=0;}',
  'ro/autocare/tracking/AutoDrive.java':`package ro.autocare.tracking; import android.content.Context; class AutoDrive {static int calls; static boolean connected; static void connection(Context c,String a,boolean on){calls++;connected=on;}}`,
  'ro/autocare/tracking/CarBluetoothVerifier.java':`package ro.autocare.tracking;import android.content.Context; class CarBluetoothVerifier {static boolean live; interface Result{void accept(boolean c);} static void verify(Context c,String a,Result r){r.accept(live);}}`,
  'ro/autocare/tracking/ReceiverTest.java':`package ro.autocare.tracking; import android.content.*; import android.bluetooth.*;
 public class ReceiverTest {public static void main(String[]args){
 Context c=new Context(); BluetoothDevice car=new BluetoothDevice(); CarConnectionReceiver receiver=new CarConnectionReceiver();
 CarBluetoothVerifier.live=true;
 receiver.onReceive(c,new Intent("audio",car,2));
 if(AutoDrive.calls!=1||!AutoDrive.connected)throw new AssertionError("profile-only start lost");
 receiver.onReceive(c,new Intent("headset",car,0));
 if(!AutoDrive.connected)throw new AssertionError("remaining audio profile was ignored");
 receiver.onReceive(c,new Intent("headset",car,1));
 receiver.onReceive(c,new Intent("unrelated",car,2));
 receiver.onReceive(c,new Intent("audio",null,2));
 if(AutoDrive.calls!=2)throw new AssertionError("irrelevant or incomplete event accepted");
 receiver.onReceive(c,new Intent("acl-",car,-1));
 if(AutoDrive.connected)throw new AssertionError("physical disconnect ignored");
 CarBluetoothVerifier.live=false;
 receiver.onReceive(c,new Intent("audio",car,0));
 if(AutoDrive.connected||BroadcastReceiver.finishes!=3)throw new AssertionError("async callback not completed");
 }}
`,
 };
 try{
  const paths=Object.entries(files).map(([path,content])=>{const out=join(dir,path);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,content);return out;});
  const compile=spawnSync('java',['com.sun.tools.javac.Main','-d',dir,...paths,resolve('mobile/tracking/android/src/main/java/ro/autocare/tracking/CarConnectionReceiver.java')],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const run=spawnSync('java',['-cp',dir,'ro.autocare.tracking.ReceiverTest'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
