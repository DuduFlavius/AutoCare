import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interpolateAngle,interpolateFix,measuredTransition} from '../src/lib/gps-animation';
const first={latitude:45,longitude:21,accuracy:5,timestamp:1000};
test('animation ends at measured fixes without extrapolating or changing recorded timestamps',()=>{
 const next={...first,latitude:45.0001,longitude:21.0001,timestamp:2000};
 assert.equal(measuredTransition(first,next),1000);
 const half=interpolateFix(first,next,.5);
 assert.equal(half.latitude,45.00005);assert.equal(half.timestamp,next.timestamp);
 assert.deepEqual(interpolateFix(first,next,2),next);
 assert.equal(interpolateFix(first,next,-1).latitude,first.latitude);
});
test('lost-signal gaps do not animate invented travel; impossible jumps are rejected',()=>{
 assert.equal(measuredTransition(first,{...first,timestamp:17000}),0);
 assert.equal(measuredTransition(first,{...first,latitude:46,timestamp:2000}),null);
 assert.equal(measuredTransition(first,{...first,timestamp:2000},true),0);
});
test('bearings and longitude cross north and the date line by the short arc',()=>{
 assert.equal(interpolateAngle(350,10,.5),0);
 assert.equal(interpolateAngle(10,350,.5),0);
 assert.equal(interpolateFix({...first,longitude:179.9},{...first,longitude:-179.9},.5).longitude,-180);
});
