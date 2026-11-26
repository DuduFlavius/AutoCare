import { test } from 'node:test';
import assert from 'node:assert/strict';
import { automaticMapQuality, readMapQuality, renderQuality } from '../src/lib/drive-render-quality';
import { driveManeuver, describeDriveManeuver } from '../src/lib/drive-maneuvers';
import { routeGeometry, visualTrackGeometry } from '../src/lib/road-map';
import { parseDrivingRoutes } from '../src/lib/road-provider-data';
import type { GPSFix } from '../src/lib/gps-tracking';

test('unknown provider maneuvers never become an unconfirmed direction',()=>{
  const turn={type:'future maneuver',modifier:'right',location:[21,45] as [number,number]};
  assert.equal(driveManeuver(turn).kind,'unknown');
  assert.equal(describeDriveManeuver(turn,false),'Urmează traseul indicat');
  assert.equal(driveManeuver({type:'fork'}).kind,'unknown');
  assert.equal(driveManeuver({type:'on ramp'}).kind,'ramp-on');
  assert.equal(driveManeuver({type:'off ramp'}).kind,'ramp-off');
  assert.equal(driveManeuver({type:'use lane'}).kind,'lane');
  assert.equal(driveManeuver({type:'roundabout',exit:0}).exit,undefined);
  assert.equal(driveManeuver({type:'roundabout',exit:3}).exit,3);
});

test('route provider exit signs are retained only when provided',()=>{
  const coordinates:[[number,number],[number,number]]=[[21,45],[21.01,45.01]];
  const step={name:'DN 6',exits:'17',destinations:'Centru',ref:'DN 6',duration:30,distance:400,
    geometry:{coordinates},maneuver:{type:'off ramp',modifier:'right',location:coordinates[0]}};
  const [route]=parseDrivingRoutes({code:'Ok',routes:[{duration:30,distance:400,geometry:{coordinates},
    legs:[{steps:[step,{...step,exits:undefined}]}]}]});
  assert.equal(route.legs[0].steps[0].exits,'17');
  assert.equal(route.legs[0].steps[1].exits,undefined);
});

test('render profiles bound pixel ratio and perspective independently of GPS input',()=>{
  assert.equal(readMapQuality('unsupported'),'auto');
  assert.equal(automaticMapQuality(2,8),'performance');
  assert.equal(automaticMapQuality(undefined,8),'balanced');
  assert.equal(renderQuality.performance.pitch,0);
  assert.ok(renderQuality.balanced.pixelRatio<renderQuality.premium.pixelRatio);
  assert.equal(renderQuality.premium.buildings,true);
});

test('batched geometry combines touching mapped segments without changing edges or matched cache',()=>{
  const road={id:34,tags:{highway:'secondary'},geometry:[{lat:45,lon:21},{lat:45.03,lon:21}]};
  const points:GPSFix[]=Array.from({length:6},(_,i)=>({latitude:45+.00009*i,longitude:21,accuracy:4,speed:10,heading:0,timestamp:1000+1000*i,breakBefore:i===3}));
  const edges=(value:ReturnType<typeof routeGeometry>)=>value.features.flatMap(({geometry:{coordinates}})=>
    coordinates.slice(1).map((point,i)=>[coordinates[i],point]));
  const old=routeGeometry(points,[road]);
  const roads=[road];
  const visual=visualTrackGeometry(points,roads);
  assert.ok(edges(old).length>0);
  assert.deepEqual(edges(visual),edges(old));
  assert.deepEqual(edges(routeGeometry(points,roads)),edges(old));
  assert.ok(visual.features.length<old.features.length);
  assert.deepEqual(visualTrackGeometry(points,[]).features,[]);
});
