import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
test('Bluetooth alone, walking, short bursts and stale samples never qualify as driving',()=>{
 const dir=mkdtempSync(join(tmpdir(),'autocare-driving-'));
 try{
  const harness=join(dir,'DrivingGateTest.java');
  writeFileSync(harness,`package ro.autocare.tracking;public class DrivingGateTest{public static void main(String[]args){
   if(DrivingGate.qualifies(0,60000,0))throw new AssertionError("connection is not motion");
   if(DrivingGate.usableSpeed(false,10)||DrivingGate.usableSpeed(true,1.5f))throw new AssertionError("walking or missing speed");
   if(DrivingGate.usableSpeed(true,Float.NaN)||DrivingGate.usableSpeed(true,100))throw new AssertionError("invalid GPS speed");
   if(DrivingGate.qualifies(3,2000,50)||DrivingGate.qualifies(3,15000,10)||DrivingGate.qualifies(10,130000,100))throw new AssertionError("insufficient or stale movement");
   if(!DrivingGate.qualifies(6,12000,65))throw new AssertionError("measured drive rejected");
   if(DrivingGate.qualifies(6,12000,Double.NaN))throw new AssertionError("invalid distance");
  }}`);
  const compile=spawnSync('java',['com.sun.tools.javac.Main','-d',dir,resolve('mobile/tracking/android/src/main/java/ro/autocare/tracking/DrivingGate.java'),harness],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr);
  const run=spawnSync('java',['-cp',dir,'ro.autocare.tracking.DrivingGateTest'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
