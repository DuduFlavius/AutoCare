/** Isolated real-component browser checks. Mock API only; never accesses production accounts. */
import {mkdtemp,writeFile,readFile,copyFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';


const root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),'autocare-ai-ui-'));
const css=(await readFile('src/components/site-document.tsx','utf8')).match(/import '@\/app\/[^']+\.css';/g).map(line=>line.replace('@/',root+'/src/')).join('\n');
const dashboardCss=(await readFile('src/components/dashboard.tsx','utf8')).match(/import '[^']+\.css';/g).map(line=>line.replace("import './","import '"+root+"/src/components/")).join('\n');
const entry=`${css}
${dashboardCss}
import React from '${root}/node_modules/react/index.js';
import {createRoot} from '${root}/node_modules/react-dom/client.js';
import MobileNavigation from '${root}/src/components/application/mobile-navigation.tsx';
import ApplicationHeader from '${root}/src/components/application/header.tsx';
import {AutoAiWorkspace} from '${root}/src/components/application/auto-ai-workspace.tsx';
import {ApplicationLanguageProvider} from '${root}/src/components/application-locale.tsx';
window.fetch=async()=>new Response(JSON.stringify({turns:Array.from({length:innerWidth>900?0:1},(_,i)=>({id:'turn-'+i,question:'Când trebuie să fac următoarea revizie?',answer:'Următoarea revizie este programată la 65.000 km. Mai ai aproximativ 2.580 km până la revizie.',createdAt:'2026-11-19T08:00:00Z',conversationId:'fixture',feedback:null}))}),{headers:{'Content-Type':'application/json'}});
const params=new URLSearchParams(location.search);const language=params.get('lang')==='en'?'en':'ro';
const car={id:'11111111-1111-4111-8111-111111111111',brand:'AutoCare',model:'Test vehicle',plate:'TEST',odometer:84000};
createRoot(document.getElementById('root')).render(<ApplicationLanguageProvider language={language}><div className="app-shell ac-workspace ac-studio ac-reference-theme"><ApplicationHeader reference title="AutoCare AI" name="Test layout" unread={0} premium onLanguage={()=>{}} onSearch={()=>{}} onNotifications={()=>{}} onAccount={()=>{}} onPremium={()=>{}} onSignOut={()=>{}} signingOut={false} preview/><MobileNavigation tab="AutoCare AI" navigate={()=>true} path="/cont"/><main className="main" id="workspace-main"><AutoAiWorkspace vehicles={[car]} vehicleId={car.id} onVehicle={()=>{}} displayName="Flavius" premium available preview={false} onExit={()=>{}} onSaved={async()=>{}}/></main></div></ApplicationLanguageProvider>);`;
await writeFile(path.join(dir,'entry.tsx'),entry);
await build({entryPoints:[path.join(dir,'entry.tsx')],bundle:true,outfile:path.join(dir,'app.js'),absWorkingDir:root,tsconfig:path.join(root,'tsconfig.json'),jsx:'automatic',nodePaths:[path.join(root,'node_modules')],external:['/emerald-reference/*','/images/*','/mobile-reference/*','/dashboard-reference/*'],loader:{'.woff2':'dataurl','.woff':'dataurl','.png':'dataurl','.svg':'dataurl'},logLevel:'error'});
const html=`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>html,body{margin:0;background:#080c1a}</style><div id="root"></div><script src="/app.js"></script></html>`;

const out=path.join(root,'../chat-layout-qa');await mkdir(out+'/dist',{recursive:true});await mkdir(out+'/.openai',{recursive:true});
await writeFile(out+'/package.json',JSON.stringify({private:true,scripts:{}}));
await writeFile(out+'/.openai/hosting.json',JSON.stringify({static:{directory:'dist'}}));
await copyFile(dir+'/app.js',out+'/dist/app.js');await copyFile(dir+'/app.css',out+'/dist/app.css');
await writeFile(out+'/dist/fixture.html',html);
await writeFile(out+'/dist/index.html',`<!doctype html><html><body style="margin:0;background:#444"><iframe title="Chat viewport" id="viewport" style="border:0;display:block"></iframe><script>const q=new URLSearchParams(location.search);const f=document.getElementById('viewport');f.width=q.get('w')||1366;f.height=q.get('h')||768;f.src='/fixture.html?lang='+(q.get('lang')||'ro');if(q.has('fit')){f.style.transformOrigin='top left';f.style.transform='scale('+Math.min(innerWidth/Number(f.width),innerHeight/Number(f.height))+')';document.body.style.overflow='hidden';}</script></body></html>`);
console.log('Built isolated layout fixture');
