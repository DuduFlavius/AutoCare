import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../scripts/migrate';
import { auth } from '../src/lib/auth';
import { closeLocalDb } from '../src/lib/db';
import { GET } from '../src/app/api/v1/[...path]/route';
delete process.env.DATABASE_URL;
process.env.LOCAL_DATABASE_PATH='memory';
process.env.APP_URL='http://localhost:3000';
process.env.BETTER_AUTH_SECRET='isolated-application-session-secret-32-characters';
process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION='false';
test('real login opens the private dashboard and real logout invalidates that session',async()=>{
  await migrate();
  try {
    const request=(path:string,body:unknown,cookie='')=>new Request('http://localhost:3000/api/auth/'+path,{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
    const credentials={email:'mobile-redesign@example.invalid',password:'isolated-redesign-password-123'};
    assert.equal((await auth().handler(request('sign-up/email',{...credentials,name:'Redesign test'}))).status,200);
    const login=await auth().handler(request('sign-in/email',credentials));
    assert.equal(login.status,200);
    const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    assert.ok(cookie);
    const dashboard=()=>GET(new Request('http://localhost:3000/api/v1/dashboard',{headers:{Cookie:cookie}}),{params:Promise.resolve({path:['dashboard']})});
    assert.equal((await dashboard()).status,200);
    assert.equal((await auth().handler(request('sign-out',{},cookie))).status,200);
    assert.equal((await dashboard()).status,401);
  } finally { await closeLocalDb(); }
});
