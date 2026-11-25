import assert from 'node:assert/strict';
import test from 'node:test';
import {defaultMapLight,mapIsDay,readMapLight,solarWindow} from '../src/lib/smartdrive-light';

const location={latitude:45.75,longitude:21.23};
test('Timișoara at 17:30 is dark in late November and light in June',()=>{
  assert.equal(mapIsDay(defaultMapLight,new Date('2026-11-25T17:30:00+02:00'),location),false);
  assert.equal(mapIsDay(defaultMapLight,new Date('2026-06-25T17:30:00+03:00'),location),true);
  assert.equal(mapIsDay(defaultMapLight,new Date('2026-11-25T11:00:00+02:00'),location),true);
});
test('automatic mode can dim before sunset and respects geographic longitude',()=>{
  const events=solarWindow(new Date('2026-11-25T12:00:00+02:00'),location.latitude,location.longitude);
  assert.ok('sunset' in events);
  const justBefore=new Date(events.sunset-5*60_000);
  assert.equal(mapIsDay(defaultMapLight,justBefore,location),true);
  assert.equal(mapIsDay({...defaultMapLight,lead:10},justBefore,location),false);
  assert.equal(mapIsDay(defaultMapLight,justBefore,{...location,longitude:28}),false);
});
test('forced modes and local schedules crossing midnight work independently of the sun',()=>{
  const at=(time:string)=>new Date('2026-11-25T'+time+':00');
  const options={...defaultMapLight,mode:'schedule' as const,day:'20:00',night:'06:00'};
  assert.equal(mapIsDay(options,at('01:00'),location),true);
  assert.equal(mapIsDay(options,at('18:00'),location),false);
  assert.equal(mapIsDay({...options,mode:'day'},at('03:00'),location),true);
  assert.equal(mapIsDay({...options,mode:'night'},at('12:00'),location),false);
  assert.deepEqual(readMapLight(JSON.stringify(options)),options);
  assert.equal(readMapLight('{"mode":"invalid"}'),defaultMapLight);
});
