import test from 'node:test';
import assert from 'node:assert/strict';
import {drivingBearing,drivingZoom,daylightMap} from '../src/lib/driving-camera';
import {parseSavedDestinations,rememberDestination} from '../src/lib/drive-destinations';
const fix={latitude:45,longitude:21,accuracy:5,timestamp:1000,speed:10,heading:0};
test('camera crosses north on the short arc without rotating backwards through 180 degrees',()=>{const heading=drivingBearing(fix,{...fix,timestamp:2000,heading:1},359);assert.ok(heading>359||heading<2);});
test('camera ignores noisy headings at rest, weak fixes and gaps',()=>{
 assert.equal(drivingBearing(fix,{...fix,timestamp:2000,speed:0,heading:180},25),25);
 assert.equal(drivingBearing(fix,{...fix,timestamp:2000,accuracy:500,heading:180},25),25);
 assert.equal(drivingBearing(fix,{...fix,timestamp:2000,breakBefore:true,heading:180},25),25);
});
test('camera derives travel bearing from displacement without a compass and zooms in before turns',()=>{
 const heading=drivingBearing(fix,{...fix,longitude:21.001,timestamp:11000,heading:null},0);assert.ok(heading>30&&heading<40);
 assert.ok(drivingZoom(20,500)>drivingZoom(40,500));
 assert.ok(drivingZoom(40,50)>drivingZoom(40,500));
 assert.equal(daylightMap(6),false);assert.equal(daylightMap(12),true);assert.equal(daylightMap(20),false);
});
test('saved destinations reject malformed storage and deduplicate only actual coordinates',()=>{
 const home={name:'Acasă',latitude:45,longitude:21};
 assert.deepEqual(parseSavedDestinations([home,{...home,latitude:Infinity},{...home,longitude:999},null]),[home]);
 assert.equal(rememberDestination([home],{...home,name:'Home'}).length,1);
 assert.equal(rememberDestination([home],{...home,latitude:46}).length,2);
});
