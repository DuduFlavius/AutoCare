import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plannedRouteBounds,routeGeometry,roadMapStyle,streetOnlyStyle} from '../src/lib/road-map';
const p=(longitude:number,breakBefore=false)=>({latitude:45,longitude,accuracy:5,timestamp:1000,breakBefore});
test('road map never draws a bridge across a GPS outage',()=>{const value=routeGeometry([p(21,true),p(21.001),p(22,true),p(22.001)]);assert.equal(value.features.length,2);assert.deepEqual(value.features[0].geometry.coordinates,[[21,45],[21.001,45]]);assert.deepEqual(value.features[1].geometry.coordinates,[[22,45],[22.001,45]]);});
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
