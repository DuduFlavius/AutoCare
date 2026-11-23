/** Local-only visual fixture. Real UI components, synthetic telemetry, no account or GPS access. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const root=process.cwd(),out=process.env.AUTOCARE_SMARTDRIVE_QA_DIR||'/workspace/shared/autocare-smartdrive-qa';
await mkdir(out,{recursive:true});
const appCss=(await readFile('src/components/site-document.tsx','utf8')).match(/import '@\/app\/[^']+\.css';/g).map(x=>x.replace('@/',root+'/src/')).join('\n');
const workspaceCss=(await readFile('src/components/dashboard.tsx','utf8')).match(/import '[^']+\.css';/g).map(x=>x.replace("import './","import '"+root+"/src/components/")).join('\n');
const entry=`${appCss}\n${workspaceCss}
import React from '${root}/node_modules/react/index.js';
import {createRoot} from '${root}/node_modules/react-dom/client.js';
import {Play,Pause,Square,CheckCheck} from 'lucide-react';
import AutoPointsMap from '${root}/src/components/auto-points-map.tsx';
import {PremiumDialogHost,requestConfirmation} from '${root}/src/components/premium-dialogs.tsx';
import {ApplicationLanguageProvider} from '${root}/src/components/application-locale.tsx';
const state=new URLSearchParams(location.search).get('state')||'idle';
const active=['active','weak','guiding','unavailable'].includes(state),paused=state==='paused',finished=state==='finished';
const p={latitude:45.75,longitude:21.23,accuracy:state==='weak'?150:5,timestamp:Date.now(),speed:state==='weak'||state==='unavailable'?null:20,heading:0};
const coords=[[21.23,45.75],[21.23,45.751],[21.231,45.752]];
const route={distance:1200,duration:110,geometry:{coordinates:coords},legs:[{steps:[{name:'Stradă de test',distance:600,duration:55,geometry:{coordinates:coords.slice(0,2)},maneuver:{type:'depart',modifier:'straight',location:coords[0]}},{name:'Destinație de test',distance:600,duration:55,geometry:{coordinates:coords.slice(1)},maneuver:{type:'turn',modifier:'right',location:coords[1]}}]}]};
function Fixture(){
 const [phase,setPhase]=React.useState(state==='review'?'unsaved':paused?'paused':finished?'finished':active?'active':'idle');
 const recording=phase==='active'||phase==='paused';
 const start=()=>setPhase('active'), stop=()=>setPhase('unsaved');
 return <ApplicationLanguageProvider language="ro"><div className="app-shell ac-workspace ac-studio ac-reference-theme"><PremiumDialogHost/><main id="workspace-main" className="main">
  <AutoPointsMap preview visible ownerId="visual-test-only" previewRoute={state==='guiding'?route:undefined} previewNavigation={state==='guiding'} session={{
   position:state==='unavailable'?null:p,points:[],meters:phase==='idle'?0:12450,seconds:phase==='idle'?0:1115,
   speed:phase==='active'&&state!=='weak'&&state!=='unavailable'?72:null,average:phase==='idle'?null:40,maximum:phase==='idle'?null:91,
   signal:state==='weak'?'weak':state==='unavailable'?'error':'connected',state:phase,active:phase==='active',start,stop,locate:()=>{},
   vehicle:<label>Vehicul<select aria-label="Vehicul" defaultValue="logan"><option value="logan">Dacia Logan · DEMO 01</option></select></label>,
   vehicleLabel:'Dacia Logan · DEMO 01',startedAt:phase==='idle'?null:Date.now()-1115000,
   controls:phase==='active'?<button className="sd-pause" onClick={()=>setPhase('paused')}><Pause size={23}/>Pauză</button>:
    phase==='unsaved'?<button className="sd-start primary" onClick={()=>setPhase('finished')}><CheckCheck size={22}/>Salvează sesiunea</button>:
    <button className="sd-start primary" onClick={start}><Play size={23}/>{phase==='paused'?'Continuă':'Pornește sesiunea'}</button>,
   finishControl:recording?<button className="sd-finish" onClick={async()=>{if(await requestConfirmation('Finalizezi sesiunea?'))stop()}}><Square size={23}/>Finalizează</button>:null
  }}/>
 </main></div></ApplicationLanguageProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);`;
await writeFile(out+'/entry.tsx',entry);
await build({entryPoints:[out+'/entry.tsx'],bundle:true,minify:true,outfile:out+'/app.js',absWorkingDir:root,tsconfig:root+'/tsconfig.json',jsx:'automatic',nodePaths:[root+'/node_modules'],define:{'process.env.NODE_ENV':'"production"'},external:['/emerald-reference/*','/images/*','/mobile-reference/*','/dashboard-reference/*'],loader:{'.woff2':'dataurl','.woff':'dataurl','.png':'dataurl','.svg':'dataurl'},logLevel:'error'});
await writeFile(out+'/frame.html',`<!doctype html><html lang="ro"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"><style>html,body{margin:0!important;overflow:hidden!important;background:#f6f9fb}body .app-shell.ac-workspace.ac-studio{display:block!important;min-height:100dvh!important}html body .app-shell.ac-workspace.ac-studio main.main#workspace-main{display:block!important;margin:0!important;padding:0!important;width:100%!important;max-width:none!important;min-height:0!important;height:100dvh!important;overflow:hidden!important}</style><div id="root"></div><script src="app.js"></script></html>`);
await writeFile(out+'/index.html',`<!doctype html><html lang="ro"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SmartDrive 5 — verificare vizuală</title><style>body{margin:0;background:#d8e4eb;font:14px Arial;color:#142333}header{padding:10px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}select{padding:7px;border-radius:8px}iframe{display:block;margin:auto;border:1px solid #acbec9;border-radius:18px;background:white;max-width:none}</style><header><strong>QA · date fictive · GPS oprit</strong><label>Lățime <select id="width">${[320,375,390,430,1280].map(w=>`<option ${w===390?'selected':''}>${w}</option>`).join('')}</select></label><label>Stare <select id="state">${['idle','active','paused','review','finished','unavailable','weak','guiding'].map(s=>`<option>${s}</option>`).join('')}</select></label></header><iframe id="viewport" title="SmartDrive — componente reale cu date fictive" width="390" height="844" src="frame.html?state=idle"></iframe><script>const f=document.getElementById('viewport'),w=document.getElementById('width'),s=document.getElementById('state');w.onchange=()=>{f.width=w.value;f.height=w.value==='1280'?850:844};s.onchange=()=>{f.src='frame.html?state='+s.value};</script></html>`);
console.log(out+'/index.html');
