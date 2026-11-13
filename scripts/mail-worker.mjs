/** Render Free worker: resumes persistent queued mail while this web instance is running. */
import {setTimeout as delay} from 'node:timers/promises';
let running=true;
const abort=new AbortController();
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{running=false;abort.abort();});
if(!process.env.CRON_SECRET){console.error(JSON.stringify({event:'autocare_mail_worker',status:'missing_cron_secret'}));process.exit(0);}
const port=Number(process.env.PORT||10000);
if(!Number.isInteger(port)||port<1||port>65535)process.exit(1);
while(running){
 try{
  const response=await fetch(`http://127.0.0.1:${port}/api/v1/jobs/mail`,{headers:{Authorization:'Bearer '+process.env.CRON_SECRET},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(50000)]),cache:'no-store'});
  if(response.ok){const result=await response.json();if(result.accepted)console.log(JSON.stringify({event:'autocare_mail_worker',accepted:result.accepted}));}
 }catch{/* Startup, shutdown and temporary failures leave messages in the database queue. */}
 if(running)try{await delay(30000,undefined,{signal:abort.signal});}catch{break;}
}
