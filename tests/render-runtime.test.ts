import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderRuntime} from '../scripts/render-runtime.mjs';
const env={DATABASE_URL:'postgresql://user:password@database.invalid/autocare',BETTER_AUTH_SECRET:'test-secret-with-more-than-32-characters',RENDER_EXTERNAL_URL:'https://autocare.onrender.com',PORT:'10000'};
test('Render startup reuses an external database and platform URL until a custom domain is configured',()=>{
 assert.deepEqual(renderRuntime(env),{origin:'https://autocare.onrender.com',port:10000});
 assert.equal(renderRuntime({...env,APP_URL:'https://garage.example'}).origin,'https://garage.example');
});
test('Render startup fails closed before migrations without persistent database or valid origin',()=>{
 for(const override of [{DATABASE_URL:''},{DATABASE_URL:'file:///tmp/garage'},{BETTER_AUTH_SECRET:'short'},{APP_URL:'http://garage.example'},{APP_URL:'https://user:secret@garage.example'},{APP_URL:'https://garage.example/path'},{PORT:'invalid'}])assert.throws(()=>renderRuntime({...env,...override}));
});

test('canonical links use Render initially and an explicit custom domain later',async()=>{
 const previous={APP_URL:process.env.APP_URL,RENDER_EXTERNAL_URL:process.env.RENDER_EXTERNAL_URL};
 try{
  const {origin}=await import('../src/lib/config');
  delete process.env.APP_URL;process.env.RENDER_EXTERNAL_URL='https://autocare.onrender.com';
  assert.equal(origin(),'https://autocare.onrender.com');
  process.env.APP_URL='https://garage.example';assert.equal(origin(),'https://garage.example');
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
