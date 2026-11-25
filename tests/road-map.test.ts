import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drivingInsets} from '../src/lib/driving-camera';
import {plannedRouteBounds,routeGeometry,roadMapStyle,streetOnlyStyle} from '../src/lib/road-map';
const p=(longitude:number,breakBefore=false,timestamp=1000)=>({latitude:45,longitude,accuracy:5,timestamp,breakBefore});
test('road map never draws a bridge across a GPS outage',()=>{
  const value=routeGeometry([p(21,true),p(21.0003,false,2000),p(22,true,3000),p(22.0003,false,4000)]);
  assert.deepEqual(value.features.map(f=>f.geometry.coordinates),[[[21,45],[21.0003,45]],[[22,45],[22.0003,45]]]);
});
test('unmarked GPS gaps and long chords never bridge recorded clusters',()=>{
  const value=routeGeometry([p(21),p(21.0003,false,2000),p(21.0015,false,6000),p(21.0018,false,7000),p(21.0021,false,20000),p(21.0024,false,21000)]);
  assert.equal(value.features.length,3);
  assert.ok(value.features.every(f=>f.geometry.coordinates.length===2));
});
test('a recorded right turn retains the corner and suppresses an unsupported diagonal',()=>{
  const start={...p(21),speed:8,heading:90};
  const corner={...p(21.0002,false,3000)};
  const end={...corner,latitude:45.0002,timestamp:6000,speed:8,heading:0};
  assert.deepEqual(routeGeometry([start,corner,end]).features[0].geometry.coordinates,[[21,45],[21.0002,45],[21.0002,45.0002]]);
  assert.equal(routeGeometry([start,end]).features.length,0);
});
test('low-accuracy and reordered fixes break the visible route without moving stored points',()=>{
  const points=[p(21),{...p(21.0001,false,2000),accuracy:35},p(21.0002,false,3000),p(21.0003,false,2000),p(21.0004,false,4000)];
  const original=structuredClone(points);
  assert.equal(routeGeometry(points).features.length,0);
  assert.deepEqual(points,original);
});
test('empty routes and isolated fixes do not fabricate a traveled path',()=>{assert.equal(routeGeometry([]).features.length,0);assert.equal(routeGeometry([p(21,true),p(22,true)]).features.length,0);assert.match(roadMapStyle,/\/styles\/fiord$/);assert.doesNotMatch(roadMapStyle,/satellite/i);});

test('street mode removes imagery and terrain while keeping road layers',()=>{const style=streetOnlyStyle({version:8,sources:{},layers:[{id:"satellite",type:"raster",source:"photo"},{id:"terrain",type:"hillshade",source:"dem"},{id:"roads",type:"line",source:"street"}]});assert.deepEqual(style.layers.map(l=>l.id),["roads"]);});

test('route overview includes bends outside the start and destination viewport', () => {
  assert.deepEqual(plannedRouteBounds([[21, 45], [21.5, 44.5], [21.1, 45.1]]), [[21, 44.5], [21.5, 45.1]]);
});

test('street style removes square base markers and railway ties while keeping streets and labels', () => {
  const style = streetOnlyStyle({version: 8, sources: {}, layers: [
    {id: 'railway_dashline', type: 'line', source: 'roads'},
    {id: 'railway_service_dashline', type: 'line', source: 'roads'},
    {id: 'railway_service', type: 'line', source: 'roads'},
    {id: 'place_town', type: 'symbol', source: 'places', layout: {'icon-image': 'square', 'text-field': '{name}'}},
    {id: 'poi', type: 'symbol', source: 'places', layout: {'icon-image': 'poi'}},
  ]});
  assert.deepEqual(style.layers.map(layer => layer.id), ['railway_service', 'place_town']);
  assert.deepEqual(style.layers[1].layout, {'text-field': '{name}'});
});

test('the street palette gives roads, water and labels distinct dark-map contrast', () => {
 const style = streetOnlyStyle({version:8,sources:{},layers:[
  {id:'background',type:'background'},
  {id:'water',type:'fill',source:'streets'},
  {id:'highway_primary',type:'line',source:'streets'},
  {id:'highway_minor',type:'line',source:'streets'},
  {id:'road_label',type:'symbol',source:'streets',layout:{'text-field':'{name}'}},
 ]});
 assert.equal(style.layers[0].paint?.['background-color' as keyof typeof style.layers[0]['paint']], '#10232d');
 assert.notDeepEqual(style.layers.find(layer=>layer.id==='highway_primary')?.paint,style.layers.find(layer=>layer.id==='highway_minor')?.paint);
 assert.ok(JSON.stringify(style.layers.find(layer=>layer.id==='road_label')?.paint).includes('#d8e6e8'));
});

test('matched GPS fixes use the real mapped curve, not the diagonal chord',()=>{
  const start={...p(21,false,1000),speed:6,heading:90};
  const end={...p(21.0002,false,6000),latitude:45.0002,speed:6,heading:0};
  const roads=[{tags:{highway:'residential'},geometry:[{lon:21,lat:45},{lon:21.0002,lat:45},{lon:21.0002,lat:45.0002}]}];
  assert.deepEqual(routeGeometry([start,end],roads).features[0]?.geometry.coordinates,[[21,45],[21.0002,45],[21.0002,45.0002]]);
  assert.equal(routeGeometry([start,end],[]).features.length,0);
});

test('ambiguous parallel ways and wrong-way travel leave a gap',()=>{
  const a={...p(21),latitude:45.00003,heading:90,speed:8};
  const b={...a,longitude:21.0003,timestamp:4000};
  const road=(lat:number,oneway?:string)=>({tags:{highway:'residential',...(oneway?{oneway}:{})},geometry:[{lon:21,lat},{lon:21.0003,lat}]});
  assert.equal(routeGeometry([a,b],[road(45),road(45.00006)]).features.length,0);
  assert.equal(routeGeometry([a,b],[road(45,'-1')]).features.length,0);
  assert.equal(routeGeometry([a,b],[road(45)]).features.length,1);
});

test('the tracking camera reserves space for the header and bottom controls',()=>{
  for(const [height,header,dock] of [[720,110,155],[530,80,210],[360,65,230]]){
    const inset=drivingInsets(height,header,dock);
    const point=(height+inset.top-inset.bottom)/2;
    assert.ok(Math.abs((point-header)/(height-header-dock)-.72)<.0001);
  }
});

test('connected OSM ways can join across a shared node but never across an overpass',()=>{
  const a={...p(21,false,1000),heading:90,speed:8};
  const b={...p(21.0002,false,5000),latitude:45.0002,heading:0,speed:8};
  const entry={nodes:[101,102],tags:{highway:'residential'},geometry:[{lon:21,lat:45},{lon:21.0002,lat:45}]};
  const exit={nodes:[102,103],tags:{highway:'residential'},geometry:[{lon:21.0002,lat:45},{lon:21.0002,lat:45.0002}]};
  assert.deepEqual(routeGeometry([a,b],[entry,exit]).features[0]?.geometry.coordinates,[[21,45],[21.0002,45],[21.0002,45.0002]]);
  assert.equal(routeGeometry([a,b],[entry,{...exit,nodes:[204,103]}]).features.length,0);
  assert.equal(routeGeometry([a,{...b,breakBefore:true}],[entry,exit]).features.length,0);
});

test('uses the one-way arc across a roundabout closing node',()=>{
  const road={nodes:[1,2,3,4,1],tags:{junction:'roundabout'},geometry:[
    {lon:21,lat:45},{lon:21.0001,lat:45},{lon:21.0001,lat:45.0001},{lon:21,lat:45.0001},{lon:21,lat:45},
  ]};
  const enter={...p(21),latitude:45.00005,speed:5,heading:180};
  const exit={...p(21.00005,false,5000),speed:5,heading:90};
  const coordinates=routeGeometry([enter,exit],[road]).features[0]?.geometry.coordinates;
  assert.deepEqual(coordinates,[[21,45.00005],[21,45],[21.00005,45]]);
});

test('navigation map adds an idempotent local-road casing and quiet buildings',()=>{
 const source={version:8 as const,sources:{},layers:[
  {id:'highway_minor',type:'line' as const,source:'roads','source-layer':'transportation'},
  {id:'highway_path',type:'line' as const,source:'roads'},
  {id:'building',type:'fill' as const,source:'roads'},
 ]};
 const day=streetOnlyStyle(source,true);
 const night=streetOnlyStyle(day,false);
 assert.deepEqual(day.layers.map(layer=>layer.id),['autocare-local-casing','highway_minor','building']);
 assert.deepEqual(night.layers.map(layer=>layer.id),day.layers.map(layer=>layer.id));
 assert.equal(day.layers[2].minzoom,15);
 assert.notDeepEqual(day.layers[0].paint,night.layers[0].paint);
 assert.match(JSON.stringify(day.layers[0].paint),/interpolate/);
});
