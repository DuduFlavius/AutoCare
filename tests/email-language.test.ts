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

test('registration language uses weighted browser preferences without inferring language from IP',async()=>{
 const {registrationLanguage}=await import('../src/lib/mail-language');
 assert.equal(registrationLanguage('en-GB,en;q=0.9,ro;q=0.4'),'en');
 assert.equal(registrationLanguage('en;q=0.2,ro-RO;q=0.9'),'ro');
 assert.equal(registrationLanguage('fr-FR,fr;q=0.8'),'en');
 assert.equal(registrationLanguage('en;q=0,ro;q=.8'),'ro');
 assert.equal(registrationLanguage(null),'ro');
});
test('email canvas is light, compact and escapes custom subjects and messages',()=>{
 const mail=renderEmail('administrative',{subject:'Service <update>',message:'Own <script>message</script>\n\nSecond paragraph'});
 assert.ok(mail.html.includes('background:#edf1f7'));
 assert.ok(mail.html.includes('Service &lt;update&gt;</h1>'));
 assert.ok(!mail.html.includes('background:#090D14'));
 assert.ok(!mail.html.includes('<script>message'));
 assert.ok(mail.text.includes('Second paragraph'));
});
