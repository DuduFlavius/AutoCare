import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('mail worker authenticates its local queue request and stops on SIGTERM without logging credentials',async()=>{
 const secret='isolated-worker-secret';
 let requestPath='',authorization='';
 let done!:()=>void;const received=new Promise<void>(resolve=>{done=resolve;});
 const server=createServer((req,res)=>{requestPath=req.url??'';authorization=req.headers.authorization??'';res.writeHead(200,{'Content-Type':'application/json'});res.end('{"accepted":1}');done();});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=(server.address() as {port:number}).port;
 const child=spawn(process.execPath,['scripts/mail-worker.mjs'],{env:{NODE_ENV:'test',PATH:process.env.PATH,PORT:String(port),CRON_SECRET:secret},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',chunk=>logs+=String(chunk));child.stderr.on('data',chunk=>logs+=String(chunk));
 try{
  await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(Error('worker timeout')),5000).unref())]);
  assert.equal(requestPath,'/api/v1/jobs/mail');assert.equal(authorization,'Bearer '+secret);
  const exited=once(child,'exit');child.kill('SIGTERM');await exited;
  assert.ok(!logs.includes(secret));
 }finally{child.kill('SIGTERM');await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
