import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDriveManeuver, driveManeuver } from '../src/lib/drive-maneuvers';
import { alternateRouteGeometry, streetOnlyStyle } from '../src/lib/road-map';
import { parseRoadDestinations } from '../src/lib/road-provider-data';
import type { Turn } from '../src/lib/road-navigation';

test('provider turn modifiers and ramp types produce distinct, localized instructions', () => {
  const turn = (type:string, modifier?:string, exit?:number):Turn => ({type, modifier, exit, location:[21.23,45.75]});
  assert.equal(driveManeuver(turn('turn','left')).left,true);
  assert.equal(driveManeuver(turn('turn','slight right')).kind,'slight');
  assert.equal(driveManeuver(turn('turn','sharp left')).kind,'sharp');
  assert.equal(driveManeuver(turn('turn','uturn')).kind,'uturn');
  assert.equal(describeDriveManeuver(turn('off ramp','right'),false),'Ia ieșirea spre dreapta');
  assert.equal(describeDriveManeuver(turn('merge','left'),true),'Merge into traffic');
  assert.match(describeDriveManeuver(turn('rotary','right',3),false),/ieșirea 3/);
  assert.equal(driveManeuver(turn('arrive')).kind,'arrive');
  assert.equal(describeDriveManeuver(turn('turn','straight'),false),'Continuă înainte');
});

test('search keeps the full address and distinguishes provider-confirmed vehicle POIs', () => {
  const feature = (properties:Map<string,string>, coordinates:[number,number]) => ({
    properties:Object.fromEntries(properties), geometry:{type:'Point',coordinates},
  });
  const results = parseRoadDestinations({features:[
    feature(new Map([['name','Parcare publică'],['osm_key','amenity'],['osm_value','parking'],['city','Timișoara']]),[21.23,45.75]),
    feature(new Map([['street','Strada Lalelelor'],['housenumber','12'],['city','Timișoara'],['country','România']]),[21.24,45.76]),
  ]},45.73,21.22,'Lalelelor 12');
  assert.equal(results[0].name,'Strada Lalelelor 12');
  assert.equal(results[0].details,'Timișoara, România');
  assert.equal(results[1].category,'parking');
  assert.ok(results.every(result => result.distanceKm > 0));
});

test('alternative features retain route indexes and 3D uses source building heights', () => {
  const variants = alternateRouteGeometry([{index:2,coordinates:[[21,45],[21.1,45.1]]},{index:3,coordinates:[[21,45]]}]);
  assert.deepEqual(variants.features.map(feature=>feature.properties.index),[2]);
  const style = streetOnlyStyle({version:8,sources:{},layers:[
    {id:'building',type:'fill',source:'map','source-layer':'building'},
    {id:'poi',type:'symbol',source:'map','source-layer':'poi',layout:{'icon-image':'fuel'}},
  ]}, true);
  const building = style.layers.find(layer => layer.type === 'fill-extrusion');
  assert.ok(building?.type === 'fill-extrusion');
  assert.deepEqual(building.paint?.['fill-extrusion-height'],['get','render_height']);
  assert.equal(style.layers.find(layer=>layer.id==='poi')?.minzoom,15);
});
