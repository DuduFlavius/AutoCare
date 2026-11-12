import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isGoogleMailProductionRequest as allowed} from '../src/lib/google-mail-origin';
const origin='https://autocare-jglt.onrender.com';
const callback=origin+'/api/v1/mail/google/callback';
const host='autocare-jglt.onrender.com';
function request(url:string,headers:Record<string,string>={},method='GET'){return new Request(url,{method,headers});}
test('Gmail accepts its exact public production origin and same-origin POST',()=>{
 assert.equal(allowed(request(callback),callback),true);
 assert.equal(allowed(request(origin+'/api/v1/mail/google/connect',{origin},'POST'),callback),true);
 assert.equal(allowed(request(origin+'/api/v1/mail/google/connect',{origin:'https://other.invalid'},'POST'),callback),false);
});
test('Render HTTPS termination accepts the canonical Host while the internal URL uses HTTP',()=>{
 for(const url of ['http://autocare-jglt.onrender.com/api/v1/mail/google/callback','http://localhost:10000/api/v1/mail/google/callback']){
  const headers={host,'x-forwarded-proto':'https','x-forwarded-host':host};
  assert.equal(allowed(request(url,headers),callback,true),true);
  assert.equal(allowed(request(url,{...headers,origin},'POST'),callback,true),true);
  assert.equal(allowed(request(url,headers),callback,false),false);
 }
});
test('a wrong host, forged forwarded host, HTTP, multi-valued headers and cross-origin mutations stay blocked',()=>{
 const headers={host,'x-forwarded-proto':'https'};
 for(const change of ([{host:'other.invalid'},{host:host+'.evil.invalid'},{'x-forwarded-host':'other.invalid'},{'x-forwarded-proto':'http'},{'x-forwarded-proto':'https,http'},{host:host+',other.invalid'}] as Record<string,string>[]))
  assert.equal(allowed(request('http://localhost:10000/callback',{...headers,...change}),callback,true),false);
 assert.equal(allowed(request('http://localhost:10000/callback',{'x-forwarded-host':host,'x-forwarded-proto':'https'}),callback,true),false);
 assert.equal(allowed(request('http://localhost:10000/connect',{...headers,origin:'https://other.invalid'},'POST'),callback,true),false);
 assert.equal(allowed(request('http://localhost:10000/connect',headers,'POST'),callback,true),false);
 assert.equal(allowed(request('https://preview.invalid/callback'),callback),false);
});
