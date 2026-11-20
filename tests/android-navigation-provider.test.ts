import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoadDestinations,parseDrivingRoutes} from '../src/lib/road-provider-data';
test('Android geocoding preserves real fields, deduplicates addresses and rejects invalid coordinates',()=>{
 const feature={geometry:{type:'Point',coordinates:[21.2,45.7]},properties:{name:'Service',street:'Strada Test',city:'Timișoara'}};
 const values=parseRoadDestinations({features:[feature,feature,{...feature,geometry:{type:'Point',coordinates:[1000,0]}}]},45.7,21.2);
 assert.equal(values.length,1);assert.equal(values[0].details,'Strada Test, Timișoara');assert.equal(values[0].distanceKm,0);
});
test('Android route parser rejects provider failures and invented negative distances',()=>{
 assert.throws(()=>parseDrivingRoutes({code:'NoRoute',routes:[]}));
 assert.throws(()=>parseDrivingRoutes({code:'Ok',routes:[{distance:-1}]}));
 const coordinates:[[number,number],[number,number]]=[[21.2,45.7],[21.21,45.71]];
 const route={distance:1200,duration:140,geometry:{coordinates},legs:[{steps:[{name:'Drum',distance:1200,duration:140,geometry:{coordinates},maneuver:{type:'depart',location:coordinates[0]}}]}]};
 assert.deepEqual(parseDrivingRoutes({code:'Ok',routes:[route]}),[route]);
});
