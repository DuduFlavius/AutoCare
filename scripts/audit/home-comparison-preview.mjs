/** Test-only rendering of the real home component with synthetic account data. */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {build} from 'esbuild';

const root=process.cwd(), out=process.env.AUTOCARE_SMARTDRIVE_QA_DIR;
if(!out)throw Error('Set AUTOCARE_SMARTDRIVE_QA_DIR to a scratch directory.');
await mkdir(out,{recursive:true});
const css=(await readFile('src/components/site-document.tsx','utf8'))
  .match(/import '@\/app\/[^']+\.css';/g).map(line=>line.replace('@/',root+'/src/')).join('\n');
const entry=`${css}
import React from '${root}/node_modules/react/index.js';
import {createRoot} from '${root}/node_modules/react-dom/client.js';
import ApplicationHome from '${root}/src/components/application/home.tsx';
import {ApplicationLanguageProvider} from '${root}/src/components/application-locale.tsx';
const vehicle={id:'synthetic-car',brand:'Dacia',model:'Logan',plate:'QA 62 SD',odometer:90003,archived:false};
const data={profile:{userId:'synthetic',timezone:'Europe/Bucharest'},vehicles:[vehicle],premium:true,notifications:[],
 records:['ITP','RCA','Rovinietă'].map((category,index)=>({id:String(index),vehicleId:vehicle.id,kind:'document',category,title:category,date:'2025-01-01',expiresAt:'2027-02-15',cancelled:false,amountKnown:false}))};
const noop=()=>{};
const open=tab=>{document.documentElement.dataset.lastDestination=tab};
createRoot(document.getElementById('root')).render(<ApplicationLanguageProvider language="ro">
 <div className="app-shell ac-workspace ac-studio ac-reference-theme"><main className="main" id="workspace-main">
  <ApplicationHome androidSmartDrive={new URLSearchParams(location.search).get('web')!=='1'} data={data} name="Alex" selectedVehicle={vehicle.id}
   onSelectVehicle={noop} onDrill={open} navigate={open} onVehicle={()=>open('Garaj')} onCreate={noop} onRecord={noop} onRefresh={async()=>{}} currency="RON" preview/>
 </main></div>
</ApplicationLanguageProvider>);`;
await writeFile(out+'/home-entry.tsx',entry);
await build({entryPoints:[out+'/home-entry.tsx'],bundle:true,outfile:out+'/home.js',absWorkingDir:root,tsconfig:root+'/tsconfig.json',jsx:'automatic',
 nodePaths:[root+'/node_modules'],define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},external:['/emerald-reference/*','/images/*','/mobile-reference/*','/dashboard-reference/*'],
 loader:{'.woff2':'dataurl','.woff':'dataurl','.png':'dataurl','.svg':'dataurl'}});
await writeFile(out+'/home.html','<!doctype html><html lang="ro"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="home.css"><style>body{margin:0}html body .app-shell.ac-workspace.ac-studio main.main#workspace-main{margin:0!important;width:100%!important;max-width:none!important;padding:16px!important}</style><div id="root"></div><script src="home.js"></script></html>');
