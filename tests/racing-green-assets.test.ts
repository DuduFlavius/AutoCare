import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {reportBrandLogo} from '../src/lib/report-brand';
test('official search, installed-app and report marks share the emerald asset',async()=>{
 const icon=readFileSync('public/icon-192.png');
 assert.deepEqual(Buffer.from(reportBrandLogo,'base64'),icon);
 for(const [name,width,height] of [['favicon-96.png',96,96],['apple-touch-icon.png',180,180],['icon-512.png',512,512],['images/autocare-racing-green-preview.png',1200,630],['images/autocare-racing-green-preview-en.png',1200,630]] as const){const metadata=await sharp('public/'+name).metadata();assert.equal(metadata.width,width);assert.equal(metadata.height,height);}
 const svg=readFileSync('public/favicon.svg','utf8');assert.ok(svg.includes('#20E6A2'));assert.ok(!svg.includes('#398BFF'));
});
test('retired CSS rules have no empty selectors and AI reserves the actual mobile dock',()=>{
 for(const path of ['mobile-reference.css','auto-ai-premium.css'])assert.doesNotMatch(readFileSync('src/components/application/'+path,'utf8'),/(?:^|})\s*\{/);
 const ai=readFileSync('src/components/application/auto-ai-workspace.tsx','utf8');assert.ok(ai.includes("'.rg-mobile-dock'"));assert.ok(!ai.includes("'.autocare-mobile-dock'"));
});
