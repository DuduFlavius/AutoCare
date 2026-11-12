import {spawn} from 'node:child_process';
import {renderRuntime} from './render-runtime.mjs';
let runtime;
try {runtime=renderRuntime(process.env);}catch {console.error('Render configuration incomplete. Set DATABASE_URL, existing BETTER_AUTH_SECRET and a valid HTTPS APP_URL or RENDER_EXTERNAL_URL. No local database will be created.');process.exit(1);}
process.env.APP_URL=runtime.origin;
process.env.NODE_ENV='production';
// Apply the same additive migration required by Vercel before serving traffic.
function run(args) {
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{stdio:'inherit',env:process.env});
  const forward=signal=>child.kill(signal);
  const term=()=>forward('SIGTERM'),interrupt=()=>forward('SIGINT');
  process.once('SIGTERM',term);process.once('SIGINT',interrupt);
  const cleanup=()=>{process.removeListener('SIGTERM',term);process.removeListener('SIGINT',interrupt);};
  child.once('error',error=>{cleanup();reject(error);});
  child.once('exit',(code,signal)=>{cleanup();resolve(signal?1:code??1);});
 });
}
try {
 const migrated=await run(['--import','tsx','scripts/migrate-mail-center.ts']);
 if(migrated!==0)process.exit(migrated);
 process.exit(await run(['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',String(runtime.port)]));
}catch{console.error('Render startup failed. No credentials are logged.');process.exit(1);}
