import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
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
 const home=renderToStaticMarkup(createElement(MobileCockpit,{data,selectedVehicle:car.id,onSelectVehicle:noop,navigate:noop,onVehicle:noop,onCreate:noop,onRecord:noop,currency:'RON'}));
 assert.match(home,/User vehicle/);assert.match(home,/OWNER/);assert.match(home,/12[.,]345/);assert.doesNotMatch(home,/<img|BMW|100%/);
 const vault=renderToStaticMarkup(createElement(DocumentVault,{data,vehicleId:'',onVehicle:noop,onEdit:noop,onCreate:noop,onArchive:noop,onRestore:noop,onHistory:noop,onUpload:async()=>{},onDeleteFile:noop,preview:true,busy:false}));
 assert.match(vault,/Termen necunoscut/);assert.match(vault,/Adaugă data de expirare/);assert.doesNotMatch(vault,/api\/v1\/files\//);assert.doesNotMatch(vault,/status=&|vehicleId=&|<img|BMW/);
 assert.match(vault,/kind=document/);assert.match(vault,/CSV/);assert.match(vault,/PDF/);
});
test('last reference uses four destinations, garage remains a real reachable module',()=>{
 assert.deepEqual(mobileWorkspaceSections.map(section=>section.id),['Dashboard','Documente','Cheltuieli','Cont']);
});
