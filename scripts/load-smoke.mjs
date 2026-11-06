// Controlled local-only smoke load. This does not establish production/database capacity.
import {performance} from 'node:perf_hooks';
const base=new URL(process.env.LOAD_BASE_URL||'http://127.0.0.1:3011');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Local test targets only; use a separately reviewed staging load test for external infrastructure.');
const rps=Math.min(1000,Math.max(1,Number(process.env.LOAD_RPS||1000)));
const seconds=Math.min(10,Math.max(1,Number(process.env.LOAD_SECONDS||5)));
const path=process.env.LOAD_PATH||'/api/app-version';
if(!['/','/api/app-version','/api/android-update'].includes(path))throw Error('Read-only public test paths only.');
const durations=[],statuses={};let active=0,dropped=0,failures=0;const started=performance.now();const pending=new Set();
async function run(){active++;const begin=performance.now();try{const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(10000)});await r.arrayBuffer();statuses[r.status]=(statuses[r.status]||0)+1;if(!r.ok)failures++;}catch{failures++;}finally{durations.push(performance.now()-begin);active--;}}
for(let tick=0;tick<seconds*20;tick++){
 for(let i=0;i<rps/20;i++){
  if(active>=200){dropped++;continue;}
  const job=run();pending.add(job);job.finally(()=>pending.delete(job));
 }
 const deadline=started+(tick+1)*50;await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-performance.now())));
}
await Promise.all(pending);durations.sort((a,b)=>a-b);const elapsed=(performance.now()-started)/1000;
console.log(JSON.stringify({scope:'local production-build public endpoint, no authenticated DB traffic',path,targetRps:rps,durationSeconds:seconds,completed:durations.length,failures,dropped,statuses,actualRps:Math.round(durations.length/elapsed),p50Ms:Math.round(durations[Math.floor(durations.length*.5)]||0),p95Ms:Math.round(durations[Math.floor(durations.length*.95)]||0)},null,2));
process.exitCode=failures||dropped?1:0;
