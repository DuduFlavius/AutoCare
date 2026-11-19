/** Real application components with existing isolated design fixtures. No production API. */
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const root=process.cwd(),out=path.resolve(root,'../emerald-qa');
await mkdir(out+'/dist',{recursive:true});await mkdir(out+'/.openai',{recursive:true});
const globals=(await readFile('src/components/site-document.tsx','utf8')).match(/import '@\/app\/[^']+\.css';/g).map(line=>line.replace('@/',root+'/src/')).join('\n');
const source=await readFile('src/app/(romanian)/previzualizare/page.tsx','utf8');
const data=source.slice(source.indexOf('  const now ='),source.indexOf('  const previewVehicle'));
const entry=`${globals}
import React from '${root}/node_modules/react/index.js';
import {createRoot} from '${root}/node_modules/react-dom/client.js';
import Dashboard from '${root}/src/components/dashboard.tsx';
import {documentStatus} from '${root}/src/lib/config.ts';
import {normalizeWorkspaceTab} from '${root}/src/lib/workspace.ts';
import type {dashboard} from '${root}/src/lib/service';
const params=new URLSearchParams(location.search);
const previewOptions={plan:'premium',view:'finance',garage:'multi',tab:params.get('tab')||'Dashboard',echipa:'0'};
${data}
createRoot(document.getElementById('root')).render(<Dashboard name="Vizitator" previewData={data} initialTab={normalizeWorkspaceTab(previewOptions.tab)}/>);`;
await writeFile(out+'/entry.tsx',entry);
await build({entryPoints:[out+'/entry.tsx'],bundle:true,outfile:out+'/dist/app.js',absWorkingDir:root,tsconfig:root+'/tsconfig.json',jsx:'automatic',nodePaths:[root+'/node_modules'],external:['/images/*','/mobile-reference/*','/dashboard-reference/*','/emerald-reference/*','/fonts/*'],define:{'process.env':'{}'},loader:{'.woff2':'dataurl','.woff':'dataurl','.png':'dataurl','.svg':'dataurl'},logLevel:'error'});
await writeFile(out+'/dist/fixture.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>.preview-note{display:none!important}</style></head><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>');
await writeFile(out+'/dist/index.html',`<!doctype html><html><body style="margin:0;background:#161f1c"><iframe title="AutoCare design QA" id="viewport" style="border:0;display:block"></iframe><script>const q=new URLSearchParams(location.search);const f=document.getElementById('viewport');f.width=q.get('w')||390;f.height=q.get('h')||844;f.src='/fixture.html?tab='+encodeURIComponent(q.get('tab')||'Dashboard');if(q.has('fit')){f.style.transformOrigin='top left';f.style.transform='scale('+Math.min(innerWidth/Number(f.width),innerHeight/Number(f.height))+')';document.body.style.overflow='hidden';}</script></body></html>`);
for(const name of ['images','dashboard-reference','mobile-reference','emerald-reference','fonts'])await cp(root+'/public/'+name,out+'/dist/'+name,{recursive:true}).catch(()=>{});
await writeFile(out+'/package.json',JSON.stringify({private:true,scripts:{}}));
await writeFile(out+'/.openai/hosting.json',JSON.stringify({static:{directory:'dist'}}));
console.log('Built real-dashboard isolated preview');
