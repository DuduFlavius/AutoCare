import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeGeometry,roadMapStyle,streetOnlyStyle} from '../src/lib/road-map';
const p=(longitude:number,breakBefore=false)=>({latitude:45,longitude,accuracy:5,timestamp:1000,breakBefore});
test('road map never draws a bridge across a GPS outage',()=>{const value=routeGeometry([p(21,true),p(21.001),p(22,true),p(22.001)]);assert.equal(value.features.length,2);assert.deepEqual(value.features[0].geometry.coordinates,[[21,45],[21.001,45]]);assert.deepEqual(value.features[1].geometry.coordinates,[[22,45],[22.001,45]]);});
test('empty routes and isolated fixes do not fabricate a traveled path',()=>{assert.equal(routeGeometry([]).features.length,0);assert.equal(routeGeometry([p(21,true),p(22,true)]).features.length,0);assert.match(roadMapStyle,/\/styles\/bright$/);assert.doesNotMatch(roadMapStyle,/satellite/i);});

test('street mode removes imagery and terrain while keeping road layers',()=>{const style=streetOnlyStyle({version:8,sources:{},layers:[{id:"satellite",type:"raster",source:"photo"},{id:"terrain",type:"hillshade",source:"dem"},{id:"roads",type:"line",source:"street"}]});assert.deepEqual(style.layers.map(l=>l.id),["roads"]);});
