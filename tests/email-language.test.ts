import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emailTemplates,renderEmail,type EmailTemplate} from '../src/lib/email-templates';
import {englishEmailCopy} from '../src/lib/email-copy-en';
process.env.APP_URL='https://autocare.example';
test('all system email templates have English content and localized HTML, text, footer and CTA',()=>{
 assert.deepEqual(Object.keys(englishEmailCopy).sort(),Object.keys(emailTemplates).sort());
 for(const key of Object.keys(emailTemplates) as EmailTemplate[]){
  const mail=renderEmail(key,{language:'en',name:'Alex <script>'});
  assert.match(mail.html,/<html lang="en"/);
  assert.ok(mail.html.includes('Alex &lt;script&gt;'));
  assert.match(mail.text,/Hello, Alex/);
  assert.ok(!/[ăâîșțĂÂÎȘȚ]/.test(mail.text),key);
  assert.ok(!/[ăâîșțĂÂÎȘȚ]/.test(mail.html.replaceAll('%C4%83','')),key);
  assert.ok(mail.subject.startsWith('AutoCare'));
 }
});
test('English delivery translates default campaign fields and preserves custom user content',()=>{
 const base=emailTemplates.welcome;
 const translated=renderEmail('welcome',{language:'en',subject:base.subject,message:base.body,ctaLabel:base.cta});
 assert.ok(translated.text.includes(englishEmailCopy.welcome.body));
 const custom=renderEmail('welcome',{language:'en',message:'BMW M4 · TM05FFX',subject:'My workshop',ctaLabel:'Read my report'});
 assert.equal(custom.subject,'My workshop');assert.ok(custom.html.includes('BMW M4 · TM05FFX'));
 assert.ok(custom.html.includes('Read my report'));
 assert.throws(()=>renderEmail('welcome',{language:'en',actionUrl:'https://other.example'}),/EMAIL_INVALID_LINK/);
});

test('language cookie accepts only exact supported preference values',async()=>{
 const {languageCookie}=await import('../src/lib/language-preference');
 assert.equal(languageCookie('session=private; autocare-language=en; other=x'),'en');
 assert.equal(languageCookie('autocare-language=ro'),'ro');
 assert.equal(languageCookie('autocare-language=english'),null);
 assert.equal(languageCookie('other-autocare-language=en'),null);
 assert.equal(languageCookie(null),null);
});
