/** Actual React interaction checks with an isolated in-memory API. No production requests. */
import { createRequire, registerHooks } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {JSDOM}=require(process.env.SUPPORT_JSDOM_PATH || '/tmp/autocare-support-dom/node_modules/jsdom');
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Event','KeyboardEvent'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
Object.assign(globalThis,{requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true});
registerHooks({load(url,context,next){if(url.endsWith('.css'))return{format:'module',source:'',shortCircuit:true};return next(url,context);}});
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {default:SupportChat}=await import('../../src/components/support-chat');
const now=()=>new Date().toISOString();const actor='staff',customer='customer',id='thread';let viewer=actor;
const thread={id,userId:customer,title:'Original title',status:'open',name:'Real fixture customer',email:'customer@example.invalid',updatedAt:now(),createdAt:now(),assignedTo:null as string|null,unreadCount:1,lastMessage:{id:'m1',body:'Latest incoming message',authorId:customer,createdAt:now()}};
const messages=[{id:'m1',body:'Latest incoming message',authorName:thread.name,authorRole:'user',authorId:customer,createdAt:now()}];
const notes:{id:string;body:string;author:string;createdAt:string}[]=[];const calls:{path:string;method:string;data:any}[]=[];const alerts:string[]=[];
const operations={priority:'normal',workflow:'working',rating:null};
let confirmDelete=false;
dom.window.confirm=()=>confirmDelete;
Object.defineProperty(globalThis,'Notification',{value:class{static permission='granted';static requestPermission=async()=> 'granted';onclick?:()=>void;constructor(title:string){alerts.push(title);}close(){}},configurable:true});
const realFetch=globalThis.fetch;
globalThis.fetch=async(url:RequestInfo|URL,init:RequestInit={})=>{
 const path=new URL(String(url),'http://localhost:3000');const method=init.method??'GET';const data=typeof init.body==='string'?JSON.parse(init.body):null;calls.push({path:path.pathname,method,data});
 const p=path.pathname;
 if(p.endsWith('/team'))return Response.json({selfId:actor,team:[{id:actor,name:'Operator',role:'admin'},{id:'colleague',name:'Colleague',role:'assistant'}]});
 if(p.endsWith('/statistics'))return Response.json({fresh:1,active:2,resolved:3,unread:1,responseSeconds:120,resolutionSeconds:360,ratings:0,satisfaction:null,activity:[{name:'Operator',count:2}],trend:Array.from({length:14},(_,i)=>({day:'2026-11-'+String(i+1).padStart(2,'0'),count:i===13?2:0}))});
 if(p.endsWith('/context'))return Response.json({customer:{name:thread.name,email:thread.email,createdAt:thread.createdAt,verified:true},premium:false,suspended:false,vehicleCount:1,vehicles:[{id:'car',brand:'Owned',model:'Vehicle',plate:'OWN',year:2022,odometer:12345}],lastActivityAt:now(),threads:[thread],notes,events:[],operations});
 if(p.endsWith('/operations')){if(data.note)notes.push({id:'n1',body:data.note,author:'Operator',createdAt:now()});Object.assign(operations,Object.fromEntries(Object.entries(data).filter(([key])=>key!=='note')));return Response.json({ok:true});}
 if(p.endsWith('/join')){thread.assignedTo=actor;return Response.json({ok:true});}
 if(p.endsWith('/assign')){thread.assignedTo=data.assigneeId;return Response.json({ok:true});}
 if(p.endsWith('/read')||p.endsWith('/typing')||p.endsWith('/files'))return Response.json({ok:true});
 if(p.endsWith('/chat')&&method==='GET'){const status=path.searchParams.get('status')??'open',q=path.searchParams.get('q');return Response.json({selfId:viewer,threads:status===thread.status&&(!q||thread.name.includes(q))?[thread]:[],counts:{open:thread.status==='open'?1:0,completed:thread.status==='completed'?1:0,trashed:thread.status==='trashed'?1:0}});}
 if(p.endsWith('/chat')&&method==='POST'){const message={id:'m'+(messages.length+1),body:data.message,authorName:viewer===actor?'Operator':thread.name,authorRole:viewer===actor?'admin':'user',authorId:viewer,createdAt:now()};messages.push(message);thread.lastMessage={id:message.id,body:message.body,authorId:viewer,createdAt:message.createdAt};return Response.json({threadId:id,message});}
 if(p.endsWith('/chat/'+id)&&method==='PATCH'){thread.status=data.action==='complete'?'completed':data.action==='trash'?'trashed':'open';return Response.json({ok:true});}
 if(p.endsWith('/chat/'+id))return Response.json({thread,messages,hasMore:false,receipts:[],attachments:[]});
 throw Error('Unexpected isolated request '+p);
};
const root=createRoot(document.getElementById('root')!);
const tick=()=>new Promise(resolve=>setTimeout(resolve,35));
async function flush(){await act(async()=>{await tick();});}
async function until(test:()=>boolean,label:string){for(let i=0;i<25;i++){await flush();if(test())return;}throw Error('Timed out: '+label);}
const text=()=>document.body.textContent??'';
const button=(label:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent?.trim()===label);
async function click(element:Element|null|undefined){assert.ok(element,'Missing control');await act(async()=>{(element as HTMLElement).click();await tick();});}
async function fill(element:HTMLTextAreaElement|string,value:string){const field=typeof element==='string'?document.querySelector<HTMLTextAreaElement>(element)!:element;assert.ok(field);await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await tick();});}
async function select(selector:string,value:string){const field=document.querySelector<HTMLSelectElement>(selector)!;assert.ok(field);await act(async()=>{field.value=value;field.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await tick();});}
const passed:string[]=[];
try{
 await act(async()=>{root.render(createElement(SupportChat,{role:'admin'}));await tick();});
 await until(()=>text().includes('Latest incoming message'),'loaded inbox');
 assert.ok(!text().includes('AI Support Assistant'));passed.push('Human support separated from AI; latest real preview');
 await click(document.querySelector('.support-inbox-tools details summary'));
 await select('.support-inbox-tools details select','urgent');assert.equal(document.querySelectorAll('.support-thread').length,0);
 await select('.support-inbox-tools details select','');assert.equal(document.querySelectorAll('.support-thread').length,1);
 const search=document.querySelector<HTMLInputElement>('.support-search input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'No matching customer');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,400));});
 await until(()=>document.querySelectorAll('.support-thread').length===0,'search filter');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,400));});
 await until(()=>document.querySelectorAll('.support-thread').length===1,'reset search');passed.push('Search and priority filters');
 Object.defineProperty(dom.window,'innerWidth',{configurable:true,value:390});
 await click(document.querySelector('.support-thread-select'));assert.ok(document.querySelector('.support-mobile-thread'));
 await click(document.querySelector('.support-back'));assert.ok(!document.querySelector('.support-mobile-thread'));
 Object.defineProperty(dom.window,'innerWidth',{configurable:true,value:1024});await click(document.querySelector('.support-thread-select'));passed.push('Mobile list-to-chat navigation and back state');

 await click(button('Preia conversația'));await until(()=>!!document.querySelector('.support-composer textarea'),'joined');
 await fill('.support-composer textarea','Reply from the team');
 await act(async()=>{document.querySelector('.support-composer textarea')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));await tick();});
 await until(()=>messages.length===2,'Enter sends');assert.equal(messages[1].body,'Reply from the team');passed.push('Take ownership and send with Enter');
 await fill('.support-composer textarea','Not sent yet');
 const before=calls.filter(call=>call.path.endsWith('/chat')&&call.method==='POST').length;
 await act(async()=>{document.querySelector('.support-composer textarea')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true}));await tick();});
 assert.equal(calls.filter(call=>call.path.endsWith('/chat')&&call.method==='POST').length,before);passed.push('Shift+Enter does not submit');
 await click(document.querySelector('[aria-controls="support-customer-panel"]'));await until(()=>text().includes('OWN'),'profile vehicle');
 await fill('[aria-label="Notă internă"]','Internal-only note');await click(button('Salvează nota'));await until(()=>notes.length===1,'internal note');passed.push('Customer profile and internal note saved');
 await select('.support-operations-controls select:first-of-type','urgent');assert.equal(operations.priority,'urgent');passed.push('Priority update');
 await click(document.querySelector('.support-customer-panel header button'));
 const file=new File([new Uint8Array([255,216,255])],'isolated.jpg',{type:'image/jpeg'});const upload=document.querySelector<HTMLInputElement>('.support-upload input')!;Object.defineProperty(upload,'files',{configurable:true,value:[file]});await act(async()=>{upload.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await tick();});assert.ok(calls.some(call=>call.path.endsWith('/files')));passed.push('Attachment upload invokes existing endpoint');
 await click(button('Finalizează'));await until(()=>thread.status==='completed','completed');
 await click(document.querySelectorAll('.support-filters button')[1]);await until(()=>!!button('Redeschide'),'completed folder');
 await click(button('Redeschide'));await until(()=>thread.status==='open','reopen');
 await click(document.querySelectorAll('.support-filters button')[0]);await until(()=>!!button('Intră în conversație'),'reopened');await click(button('Intră în conversație'));await click(button('Finalizează'));await until(()=>thread.status==='completed','completed again');await click(document.querySelectorAll('.support-filters button')[1]);await until(()=>!!button('Șterge'),'completed actions');passed.push('Reopen and finalize again');

 const patches=calls.filter(call=>call.method==='PATCH').length;await click(button('Șterge'));assert.equal(calls.filter(call=>call.method==='PATCH').length,patches);confirmDelete=true;await click(button('Șterge'));await until(()=>thread.status==='trashed','trash');
 await click(document.querySelectorAll('.support-filters button')[2]);await until(()=>!!button('Restaurează'),'trash folder');await click(button('Restaurează'));await until(()=>thread.status==='open','restore');passed.push('Complete, deletion confirmation, trash and restore');
 await click(document.querySelectorAll('.support-filters button')[0]);await until(()=>!!button('Intră în conversație'),'reopened inbox');await click(button('Intră în conversație'));
 thread.lastMessage={id:'incoming2',body:'New client message',authorId:customer,createdAt:now()};messages.push({id:'incoming2',body:'New client message',authorName:thread.name,authorRole:'user',authorId:customer,createdAt:now()});await act(async()=>{dom.window.dispatchEvent(new dom.window.Event('focus'));await tick();});await until(()=>alerts.length>0,'new-message alert');passed.push('Incoming message in-app and browser alert');
 await click(button('Statistici'));await until(()=>text().includes('Evoluția solicitărilor'),'statistics');assert.equal(document.querySelectorAll('.support-trend-bars [role=listitem]').length,14);await click(button('Înapoi la conversații'));passed.push('Separate statistics view with 14 real buckets');
 await click(document.querySelector('[aria-controls="support-customer-panel"]'));await until(()=>!!document.querySelector('.support-customer-panel >label select'),'transfer control');await select('.support-customer-panel >label select','colleague');await until(()=>thread.assignedTo==='colleague','transfer');assert.ok(!document.querySelector('.support-composer'));passed.push('Transfer removes reply access from previous operator');
 viewer=customer;alerts.length=0;
 await act(async()=>{root.render(createElement(SupportChat,{role:'user',key:'customer'}));await tick();});await until(()=>!!document.querySelector('.support-client .support-composer textarea'),'customer interface');
 assert.ok(!document.querySelector('.support-sidebar'));assert.ok(!text().includes('AI Support Assistant'));
 await fill('.support-composer textarea','Customer follow-up');await act(async()=>{document.querySelector('.support-composer textarea')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();});
 await until(()=>messages.at(-1)?.body==='Customer follow-up','customer sent');await act(async()=>{dom.window.dispatchEvent(new dom.window.Event('focus'));await tick();});assert.equal(alerts.length,0);passed.push('Customer messaging; no false alert for own sent message');
 const incoming={id:'team-answer',body:'A real team answer',authorId:'colleague',createdAt:now()};thread.lastMessage=incoming;messages.push({...incoming,authorName:'Colleague',authorRole:'assistant'});
 await act(async()=>{dom.window.dispatchEvent(new dom.window.Event('focus'));await tick();});await until(()=>alerts.length===1,'customer new-reply notification');passed.push('Customer receives team-reply notification');
 console.log(JSON.stringify({passed,requests:calls.length,scope:'Isolated DOM, simulated API. No visual-layout or real-device assertion.'},null,2));
}finally{await act(async()=>root.unmount());globalThis.fetch=realFetch;dom.window.close();}
