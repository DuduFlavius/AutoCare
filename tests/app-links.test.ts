import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {safeAppDestination,androidAppIntent} from '../src/lib/app-links';
import {renderEmail} from '../src/lib/email-templates';
process.env.APP_URL='https://www.autocareapp.ro';
test('Email launch links keep app destinations while signed security links and website fallback stay intact',()=>{
 for(const language of ['ro','en'] as const){const mail=renderEmail('administrative',{language,ctaPath:'/cont?tab=Documente'});assert.ok(mail.html.includes('/open-app?next=%2Fcont%3Ftab%3DDocumente'));assert.ok(mail.html.includes('href="https://www.autocareapp.ro/cont?tab=Documente"'));}
 const signed='https://www.autocareapp.ro/api/auth/verify-email?token=synthetic';assert.ok(renderEmail('verification',{actionUrl:signed}).html.includes('href="'+signed+'"'));assert.doesNotMatch(renderEmail('verification',{actionUrl:signed}).html,/open-app\?next=/);
});
test('Launch page rejects external URLs, APIs, loops and encoded path tricks without discarding valid account context',()=>{
 for(const input of [undefined,'https://evil.invalid','//evil.invalid','/\\evil.invalid','/api/auth/delete-user','/open-app','/cont\n','/%2f%2fevil.invalid','/%2e%2e/api/private','/api%2fauth'])assert.equal(safeAppDestination(input),'/cont',String(input));
 assert.equal(safeAppDestination('/cont?tab=Documente'),'/cont?tab=Documente');assert.equal(safeAppDestination('/admin'),'/admin');
 assert.match(androidAppIntent('/cont?tab=Feedback'),/^intent:\/\/www\.autocareapp\.ro\/open-app\?next=%2Fcont%3Ftab%3DFeedback#Intent;scheme=https;package=ro\.autocare\.garage;/);assert.ok(androidAppIntent('/cont').includes('S.browser_fallback_url=https%3A%2F%2Fwww.autocareapp.ro%2Finstaleaza'));
});
test('Android resolves approved app links for both cold and warm launches and never loads an external target',()=>{
 const dir=mkdtempSync(join(tmpdir(),'autocare-app-links-'));
 try{const file=join(dir,'AppLinkHarness.java');writeFileSync(file,`package ro.autocare.garage; public class AppLinkHarness {static void expect(String input,String expected){String actual=AppLinkTarget.destination(input);if(!java.util.Objects.equals(actual,expected))throw new AssertionError(input+" => "+actual);} public static void main(String[] args){expect("https://www.autocareapp.ro/open-app?next=%2Fcont%3Ftab%3DDocumente","https://www.autocareapp.ro/cont?tab=Documente");expect("https://www.autocareapp.ro/cont?tab=Feedback","https://www.autocareapp.ro/cont?tab=Feedback");expect("http://www.autocareapp.ro/cont","https://www.autocareapp.ro/cont");expect("https://evil.invalid/open-app",null);expect("https://www.autocareapp.ro.evil.invalid/open-app",null);expect("javascript:alert(1)",null);expect("https://www.autocareapp.ro:444/open-app",null);expect("https://www.autocareapp.ro/open-app?next=https%3A%2F%2Fevil.invalid","https://www.autocareapp.ro/cont");expect("https://www.autocareapp.ro/open-app?next=%2Fapi%2Fauth%2Fdelete-user","https://www.autocareapp.ro/cont");expect("https://www.autocareapp.ro/open-app?next=%2F%252e%252e%2Fapi%2Fprivate","https://www.autocareapp.ro/cont");expect("https://www.autocareapp.ro/open-app?next=%2Fcont&next=%2Fadmin","https://www.autocareapp.ro/cont");}}`);
 const compiled=spawnSync('java',['com.sun.tools.javac.Main','-d',dir,resolve('mobile/android/app/src/main/java/ro/autocare/garage/AppLinkTarget.java'),file],{encoding:'utf8'});assert.equal(compiled.status,0,compiled.stderr);const run=spawnSync('java',['-cp',dir,'ro.autocare.garage.AppLinkHarness'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const activity=readFileSync('mobile/android/app/src/main/java/ro/autocare/garage/MainActivity.java','utf8');assert.match(activity,/openAppLink\(getIntent\(\)\)/);assert.match(activity,/onNewIntent\(Intent intent\)/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Published domain association grants only the existing release package and never the debug app',()=>{
 const associations=JSON.parse(readFileSync('public/.well-known/assetlinks.json','utf8'));assert.equal(associations.length,1);assert.equal(associations[0].target.package_name,'ro.autocare.garage');assert.equal(associations[0].target.namespace,'android_app');assert.match(associations[0].target.sha256_cert_fingerprints[0],/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/);
 const manifest=readFileSync('mobile/android/app/src/main/AndroidManifest.xml','utf8');assert.match(manifest,/android:autoVerify="true"/);assert.match(manifest,/android:host="www.autocareapp.ro" android:path="\/open-app"/);assert.doesNotMatch(manifest,/android:host="\*"/);
});

test('Workspace deep-link IDs keep the exact record or thread and reject path fragments',async()=>{
 const {recordAppDestination,supportAppDestination,workspaceEntryId}=await import('../src/lib/app-links');
 const document=new URL(recordAppDestination('document','record-123'),'https://www.autocareapp.ro');
 assert.equal(document.searchParams.get('tab'),'Documente');
 assert.equal(document.searchParams.get('record'),'record-123');
 const service=renderEmail('reminder',{ctaPath:recordAppDestination('service','service-123')});
 assert.match(service.html,/service-123/);
 const support=new URL(supportAppDestination('thread-8'),'https://www.autocareapp.ro');
 assert.equal(support.searchParams.get('thread'),'thread-8');
 assert.equal(workspaceEntryId('../../record'),undefined);
 assert.equal(new URL(supportAppDestination('bad&thread=other'),'https://www.autocareapp.ro').searchParams.has('thread'),false);
});
