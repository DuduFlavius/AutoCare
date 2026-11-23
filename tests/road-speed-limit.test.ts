import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { matchRoadSpeed, speedWarning, type SpeedRoad } from '../src/lib/road-speed-limit';

const fix = { latitude:45, longitude:21, accuracy:5, timestamp:0, speed:14, heading:0 };
function road(tags:SpeedRoad['tags'], offset=0): SpeedRoad {
  return {tags,geometry:[{lat:44.9999,lon:21+offset},{lat:45.0001,lon:21+offset}]};
}

test('matches numeric directional limits only with a reliable bearing',()=>{
  const roads=[road({maxspeed:'50','maxspeed:forward':'30','maxspeed:backward':'40'})];
  assert.equal(matchRoadSpeed(fix,roads),30);
  assert.equal(matchRoadSpeed({...fix,heading:180},roads),40);
  assert.equal(matchRoadSpeed({...fix,speed:0},roads),null);
  assert.equal(matchRoadSpeed(fix,[road({maxspeed:'30 mph'})]),48);
});

test('fails closed for poor accuracy, parallel roads and unsupported restrictions',()=>{
  assert.equal(matchRoadSpeed({...fix,accuracy:21},[road({maxspeed:'50'})]),null);
  assert.equal(matchRoadSpeed(fix,[road({maxspeed:'50'}),road({},0.00005)]),null);
  assert.equal(matchRoadSpeed(fix,[road({maxspeed:'50','maxspeed:conditional':'30 @ wet'})]),null);
  assert.equal(matchRoadSpeed(fix,[road({maxspeed:'RO:urban'})]),null);
  assert.equal(matchRoadSpeed(fix,[road({maxspeed:'50',oneway:'-1'})]),null);
  assert.equal(matchRoadSpeed(fix,[road({maxspeed:'50'},0.0004)]),null);
});

test('warns after sustained speeding and clears for an unknown limit or a new segment limit',()=>{
  const first=speedWarning({limit:null,first:null,active:false},50,55,1000);
  assert.equal(speedWarning(first,50,55,1000).active,false);
  const warning=speedWarning(first,50,55,2600);
  assert.equal(warning.active,true);
  assert.equal(speedWarning(warning,50,50,3000).active,true);
  assert.equal(speedWarning(warning,50,48,3000).active,false);
  assert.equal(speedWarning(warning,70,67,3000).active,false);
  assert.equal(speedWarning(warning,null,55,3000).active,false);
});
