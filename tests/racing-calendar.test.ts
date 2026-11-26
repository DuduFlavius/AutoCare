import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RacingCalendar,RacingMaintenance} from '../src/components/application/racing-screens';
import type {dashboard} from '../src/lib/service';
type Data=Awaited<ReturnType<typeof dashboard>>;
const noop=()=>{};
test('Racing calendar renders actual leap-year days and only owned active-vehicle events',()=>{
 const data={vehicles:[{id:'active',archived:false,brand:'Vehicle',model:'One',plate:'PRIVATE'}],records:[{id:'document',vehicleId:'active',kind:'document',expiresAt:'2028-02-29',cancelled:false,title:'Valid document'},{id:'foreign',vehicleId:'other',kind:'document',expiresAt:'2028-02-29',cancelled:false,title:'Foreign document'},{id:'archived',vehicleId:'active',kind:'document',expiresAt:'2028-02-29',cancelled:true,title:'Archived document'}]} as unknown as Data;
 const html=renderToStaticMarkup(createElement(RacingCalendar,{data,today:'2028-02-29',onOpen:noop,onCreate:noop}));
 assert.match(html,/aria-label="2028-02-29"/);assert.doesNotMatch(html,/2028-02-30/);assert.match(html,/Valid document/);assert.doesNotMatch(html,/Foreign document|Archived document/);
});
test('mobile maintenance preserves a known zero cost and does not count future work as completed',()=>{
 const row={id:'completed',vehicleId:'active',kind:'service',date:'2026-11-01',title:'Completed',category:'Reparație',amountBani:0,amountKnown:true,cancelled:false,parts:null,expiresAt:null,nextKm:null,odometer:1000};
 const data={profile:{timezone:'Europe/Bucharest'},vehicles:[{id:'active',archived:false,brand:'Vehicle',model:'One',plate:'PRIVATE',odometer:1000}],records:[row,{...row,id:'future',date:'2027-01-01',amountBani:90000}]} as unknown as Data;
 const html=renderToStaticMarkup(createElement(RacingMaintenance,{data,vehicleId:'active',today:'2026-11-19',money:bani=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(bani/100),onVehicle:noop,onOpen:noop,onCreate:noop}));
 assert.match(html,/0,00\s*RON/);assert.match(html,/<strong>1<\/strong><small>Intervenții/);
});
