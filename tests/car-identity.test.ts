import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
test('Android uses exact car identity; unrelated Bluetooth devices, invalid identities and other accounts never match',()=>{
  const dir=mkdtempSync(join(tmpdir(),'autocare-car-'));
  try {
    const harness=join(dir,'CarIdentityTest.java');
    writeFileSync(harness,`package ro.autocare.tracking;
public class CarIdentityTest {
  public static void main(String[] args) {
    String car="AA:BB:CC:DD:EE:FF";
    if(!CarIdentity.matches(car,car,"owner","owner","car-1"))throw new AssertionError("car rejected");
    if(!CarIdentity.matches(car,car.toLowerCase(),"owner","owner","car-1"))throw new AssertionError("case mismatch");
    String[] others={"AA:BB:CC:DD:EE:FE","00:00:00:00:00:00","02:00:00:00:00:00","My Car","",null};
    for(String other:others)if(CarIdentity.matches(car,other,"owner","owner","car-1"))throw new AssertionError("foreign device matched");
    if(CarIdentity.matches(car,car,"owner","other","car-1"))throw new AssertionError("foreign account matched");
    if(CarIdentity.matches(car,car,"","","car-1"))throw new AssertionError("empty account matched");
    if(CarIdentity.matches(car,car,"owner","owner",""))throw new AssertionError("missing car matched");
  }
}`);
    const compile=spawnSync('java',['com.sun.tools.javac.Main','-d',dir,resolve('mobile/tracking/android/src/main/java/ro/autocare/tracking/CarIdentity.java'),harness],{encoding:'utf8'});
    assert.equal(compile.status,0,compile.stderr);
    const run=spawnSync('java',['-cp',dir,'ro.autocare.tracking.CarIdentityTest'],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
