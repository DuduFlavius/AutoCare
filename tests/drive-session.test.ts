import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startDriveClock,pauseDriveClock,resumeDriveClock,finishDriveClock,driveElapsedMs,driveStats,measuredSpeed,validTripTiming} from '../src/lib/drive-session';
test('active session clock advances without GPS and excludes every pause, including finalizing in pause',()=>{
 let c=startDriveClock(1000);
 assert.equal(driveElapsedMs(c,6000),5000);
 c=pauseDriveClock(c,6000);assert.equal(driveElapsedMs(c,66000),5000);
 assert.deepEqual(pauseDriveClock(c,66000),c);
 c=resumeDriveClock(c,66000);c=pauseDriveClock(c,76000);
 assert.equal(driveElapsedMs(c,90000),15000);
 c=finishDriveClock(c,90000);assert.equal(driveElapsedMs(c,120000),15000);
 assert.deepEqual(finishDriveClock(c,121000),c);assert.deepEqual(resumeDriveClock(c,121000),c);
 assert.equal(validTripTiming(c.startedAt,c.endedAt!,15,74),true);
});
test('clock timestamps survive serialisation without interval drift or reset on return',()=>{
 const c=JSON.parse(JSON.stringify(startDriveClock(1000)));
 assert.equal(driveElapsedMs(c,3601000),3600000);
 assert.equal(driveElapsedMs(c,500),0);
});
test('session averages use active time; maximum and missing speed do not invent readings',()=>{
 assert.deepEqual(driveStats(1500,100,82.4),{averageKmh:54,maximumKmh:82});
 assert.deepEqual(driveStats(0,0,null),{averageKmh:null,maximumKmh:null});
 const fix={latitude:45,longitude:21,accuracy:5,timestamp:2000,speed:20};
 assert.equal(measuredSpeed(fix,null),72);
 assert.equal(measuredSpeed({...fix,speed:0},null),0);
 assert.equal(measuredSpeed({...fix,accuracy:100},null),null);
 assert.equal(measuredSpeed({...fix,speed:60},null),null);
 assert.equal(measuredSpeed({...fix,speed:null},null),null);
 const next={...fix,speed:null,latitude:45.0002,timestamp:3000};
 assert.ok(measuredSpeed(next,fix)!>0);
 assert.equal(measuredSpeed({...next,breakBefore:true},fix),null);
 assert.equal(measuredSpeed({...next,timestamp:14000},fix),null);
});
test('paused duration metadata cannot exceed the wall clock or mask an impossible active duration',()=>{
 assert.equal(validTripTiming(1000,121000,60,60),true);
 assert.equal(validTripTiming(1000,121000,60,150),false);
 assert.equal(validTripTiming(121000,1000,60,0),false);
 assert.equal(validTripTiming(1000,121000,60,-1),false);
 assert.equal(validTripTiming(1000,601000,20,0),false);
});
