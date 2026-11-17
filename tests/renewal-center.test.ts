import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {renewalDocument,insuranceProviders,roadPortals} from '../src/lib/renewal-documents';
import {workspaceSections,normalizeWorkspaceTab} from '../src/lib/workspace';
import {publicLanguageAlternates} from '../src/lib/public-routes';
registerHooks({load(url,context,next){if(url.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return next(url,context);}});
test('renewal selection separates vehicles, ignores archived records, keeps current policy ahead of a future renewal',()=>{
 const record={id:'current',kind:'document',vehicleId:'car',category:'RCA',cancelled:false,date:'2026-01-01',expiresAt:'2026-11-17'};
 const rows=[record,{...record,id:'expired',date:'2025-01-01',expiresAt:'2025-11-17'},{...record,id:'archived',cancelled:true,date:'2026-11-16',expiresAt:'2027-11-16'},{...record,id:'other',vehicleId:'other',expiresAt:'2028-11-17'},{...record,id:'future',date:'2026-11-18',expiresAt:'2027-11-18'}];
 const current=renewalDocument(rows,'car','RCA',new Date('2026-11-17T10:00:00Z'));
 assert.equal(current?.record.id,'current');assert.equal(current?.status.days,0);
 assert.equal(renewalDocument(rows,'car','Rovinietă'),null);
 const future=renewalDocument(rows.filter(r=>r.id==='future'),'car','RCA',new Date('2026-11-17T10:00:00Z'));
 assert.equal(future?.future,true);
 assert.equal(renewalDocument([record],'car','RCA',new Date('2026-11-18T10:00:00Z'))?.status.state,'expired');
});
test('external provider links contain no customer query data and use verified HTTPS destinations',()=>{
 for(const link of [...insuranceProviders.map(p=>p.url),...Object.values(roadPortals)]){const url=new URL(link);assert.equal(url.protocol,'https:');assert.equal(url.search,'');assert.equal(url.username,'');}
 assert.equal(normalizeWorkspaceTab('RCA & Rovinietă'),'RCA & Rovinietă');assert.ok(workspaceSections.some(s=>s.id==='RCA & Rovinietă'));
 assert.equal(publicLanguageAlternates('/rca-rovinieta','https://www.autocareapp.ro')?.en,'https://www.autocareapp.ro/en/rca-road-vignette');
});
test('Free AI screen renders membership benefits, actual supplied price and dashboard without mounting chat',async()=>{
 const {AutoAiWorkspace}=await import('../src/components/application/auto-ai-workspace');
 const {ApplicationLanguageProvider}=await import('../src/components/application-locale');
 for(const language of ['ro','en'] as const){
  const html=renderToStaticMarkup(createElement(ApplicationLanguageProvider,{language,children:createElement(AutoAiWorkspace,{vehicles:[],vehicleId:'',onVehicle:()=>{},premium:false,pricing:{monthlyBani:15000,annualBani:170000,currency:'ron',savingBani:10000,savingPercent:5.5} as never,available:true,preview:true,onSaved:async()=>{}})}));
  assert.match(html,/150/);assert.match(html,/tab=Premium/);assert.match(html,/tab=Dashboard/);assert.doesNotMatch(html,/<textarea|Access denied/);
  assert.match(html,language==='ro'?/Activează Premium/:/Activate Premium/);
 }
});
