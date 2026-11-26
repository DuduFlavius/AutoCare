import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {MobileCockpit} from '../src/components/application/mobile-cockpit';
import {DocumentVault} from '../src/components/application/document-vault';
import {mobileWorkspaceSections} from '../src/lib/workspace';
import type {dashboard} from '../src/lib/service';
const noop=()=>{};
const today=new Date().toISOString().slice(0,10);
const car={id:'11111111-1111-4111-8111-111111111111',brand:'User vehicle',model:'One',plate:'OWNER',odometer:12345,archived:false};
const document={id:'doc',vehicleId:car.id,kind:'document',category:'ITP',title:'ITP',amountBani:10000,amountKnown:true,cancelled:false,date:today,expiresAt:null,provider:null,notes:null,parts:null,odometer:null,nextKm:null,status:{state:'incomplete',days:null,label:'Termen necompletat'}};
const data={profile:{timezone:'UTC'},vehicles:[car],records:[document],attachments:[],premium:true,notifications:[]} as unknown as Awaited<ReturnType<typeof dashboard>>;
test('mobile home and document vault show owner data, no stock BMW or pretend validity',()=>{
 const home=renderToStaticMarkup(createElement(MobileCockpit,{data,selectedVehicle:car.id,onSelectVehicle:noop,navigate:noop,onVehicle:noop,onCreate:noop,onRecord:noop,onNextService:noop,money:bani=>String(bani/100),exchangeNote:''}));
 assert.match(home,/User vehicle/);assert.match(home,/OWNER/);assert.match(home,/12[.,]345/);assert.doesNotMatch(home,/<img|BMW|100%/);
 const vault=renderToStaticMarkup(createElement(DocumentVault,{data,vehicleId:'',onVehicle:noop,onEdit:noop,onCreate:noop,onArchive:noop,onRestore:noop,onHistory:noop,onUpload:async()=>{},onDeleteFile:noop,preview:true,busy:false}));
 assert.match(vault,/Termen necunoscut/);assert.match(vault,/Adaugă data de expirare/);assert.doesNotMatch(vault,/api\/v1\/files\//);assert.doesNotMatch(vault,/status=&|vehicleId=&|<img|BMW/);
 assert.match(vault,/kind=document/);assert.match(vault,/CSV/);assert.match(vault,/PDF/);
});
test('approved mobile reference exposes home, garage, add, reports and account',()=>{
 assert.deepEqual(mobileWorkspaceSections.map(section=>section.id),['Dashboard','Garaj','Acțiuni','Rapoarte','Cont']);
});

test('mobile Add action opens the real launcher and does not navigate to a fake tab',()=>{
 const nav=readFileSync(new URL('../src/components/application/mobile-navigation.tsx',import.meta.url),'utf8');
 const dashboard=readFileSync(new URL('../src/components/dashboard.tsx',import.meta.url),'utf8');
 assert.match(nav,/isAdd \? <button/);
 assert.match(nav,/type="button"/);
 assert.match(nav,/onClick=\{onAdd\}/);
 assert.match(dashboard,/onAdd=\{\(\)=>setLauncherOpen\(true\)\}/);
 assert.doesNotMatch(nav,/navigate\('Acțiuni'\)/);
});
test('mobile reference navigation keeps five unique functional destinations',()=>{
 assert.equal(new Set(mobileWorkspaceSections.map(s=>s.id)).size,5);
 for(const section of mobileWorkspaceSections){
  assert.ok(section.ro && section.en);
 }
});
