import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/app/apple-splash/route';
import manifest from '../src/app/manifest';
import { appleLaunchScreens } from '../src/lib/pwa-launch';
import { readFile } from 'node:fs/promises';
test('PWA manifest launches the existing signed-in application with real PNG icons',async()=>{
 const value=manifest();
 assert.equal(value.display,'standalone');assert.equal(value.scope,'/');assert.equal(value.start_url,'/cont');
 for(const icon of value.icons!){const bytes=await readFile('public'+new URL(icon.src,'https://example.invalid').pathname);assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');}
});
test('Apple launch image generates valid PNG dimensions and rejects unbounded image sizes',async()=>{
 assert.equal((await GET(new Request('https://example.invalid/apple-splash?w=99999&h=99999'))).status,400);
 const size=appleLaunchScreens[0];const response=await GET(new Request(`https://example.invalid/apple-splash?w=${size.w}&h=${size.h}`));
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
 assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),size.w);assert.equal(bytes.readUInt32BE(20),size.h);
});
