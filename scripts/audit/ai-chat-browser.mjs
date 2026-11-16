/** Isolated real-component browser checks. Mock API only; never accesses production accounts. */
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),'autocare-ai-ui-'));
const css=(await readFile('src/components/site-document.tsx','utf8')).match(/import '@\/app\/[^']+\.css';/g).map(line=>line.replace('@/',root+'/src/')).join('\n');
const entry=`import React from '${root}/node_modules/react/index.js';
import {createRoot} from '${root}/node_modules/react-dom/client.js';
import {AutoAiWorkspace} from '${root}/src/components/application/auto-ai-workspace.tsx';
import {ApplicationLanguageProvider} from '${root}/src/components/application-locale.tsx';
${css}
const params=new URLSearchParams(location.search);const language=params.get('lang')==='en'?'en':'ro';
const car={id:'11111111-1111-4111-8111-111111111111',brand:'AutoCare',model:'Test vehicle',plate:'TEST',odometer:84000};
createRoot(document.getElementById('root')).render(<ApplicationLanguageProvider language={language}><div className="app-shell ac-workspace ac-studio ac-reference-theme"><header className="fixture-header">AutoCare Premium <span>RO | EN</span></header><main className="main" id="workspace-main"><AutoAiWorkspace vehicles={[car]} vehicleId={car.id} onVehicle={()=>{}} premium available preview={false} onSaved={async()=>{}}/></main></div></ApplicationLanguageProvider>);`;
await writeFile(path.join(dir,'entry.tsx'),entry);
await build({entryPoints:[path.join(dir,'entry.tsx')],bundle:true,outfile:path.join(dir,'app.js'),absWorkingDir:root,tsconfig:path.join(root,'tsconfig.json'),jsx:'automatic',nodePaths:[path.join(root,'node_modules')],external:['/images/*'],loader:{'.woff2':'dataurl','.woff':'dataurl','.png':'dataurl','.svg':'dataurl'},logLevel:'error'});
const html=`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>html,body{margin:0;background:#080c1a} .fixture-header{height:62px!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:15px 22px!important;background:#10142b!important;color:#ddd!important;position:static!important;width:100%!important} .app-shell{display:block!important}.app-shell main.main#workspace-main{margin:0!important;padding:14px!important;min-height:0!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;position:static!important} @media(max-width:760px){.app-shell main.main#workspace-main{padding:10px!important}}</style><div id="root"></div><script src="/app.js"></script></html>`;
const server=http.createServer(async(req,res)=>{try{const file=req.url?.split('?')[0];res.setHeader('Content-Type',file==='/app.js'?'application/javascript':file==='/app.css'?'text/css':'text/html');res.end(file==='/app.js'||file==='/app.css'?await readFile(path.join(dir,file.slice(1))):html);}catch{res.statusCode=500;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
if(process.env.AI_CHAT_PREVIEW_ONLY==='1'){console.log('Isolated chat preview: http://127.0.0.1:'+server.address().port);await new Promise(()=>{});}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const [width,height,lang] of [[1440,960,'ro'],[390,844,'ro'],[360,740,'en']]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const turns=[];const requests=[];
  await page.route('**/api/v1/**',async route=>{const req=route.request(),url=new URL(req.url());const body=req.postDataJSON();requests.push({path:url.pathname,method:req.method(),body});
   if(req.method()==='GET')return route.fulfill({json:{turns}});
   if(url.pathname.endsWith('/feedback')){const turn=turns.find(t=>t.id===body.turnId);turn.feedback=body.feedback;return route.fulfill({json:{ok:true}});}
   if(req.method()==='DELETE'){for(let i=turns.length-1;i>=0;i--)if(body.turnIds.includes(turns[i].id))turns.splice(i,1);return route.fulfill({json:{ok:true}});}
   if(url.pathname.endsWith('/scan'))return route.fulfill({json:{category:'ITP',number:'TEST',date:'2026-01-01',expiresAt:'2027-01-01',amountRon:null}});
   const turn={id:crypto.randomUUID(),question:body.question,answer:lang==='ro'?'## Verificare pe baza datelor\n\nNu sunt înregistrate suficiente informații pentru un diagnostic.\n\n- Verifică istoricul service.\n- Completează kilometrajul.\n\n**Important:** nu inventăm date.':'## Based on your records\n\nThere is not enough information for a diagnosis.\n\n- Review your service history.\n- Update your mileage.',createdAt:new Date().toISOString(),conversationId:body.conversationId,feedback:null};turns.push(turn);await new Promise(r=>setTimeout(r,150));return route.fulfill({json:{turn,answer:turn.answer}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/?lang='+lang);
  await page.getByText(lang==='ro'?'Salut! Sunt AutoCare AI.':'Hi! I’m AutoCare AI.').waitFor();
  await page.screenshot({path:path.join(dir,`welcome-${width}-${lang}.png`)});
  const textarea=page.getByRole('textbox',{name:lang==='ro'?'Întrebarea ta':'Your question'});await textarea.fill('Salut');await textarea.press('Enter');await page.locator('.ac-ai-answer').waitFor();
  const bubble=await page.locator('.ac-ai-question').first().boundingBox();if(bubble.width<58)throw Error('Short user bubble collapsed');
  await page.getByRole('button',{name:lang==='ro'?'Răspuns util':'Helpful answer',exact:true}).click();await page.getByRole('button',{name:lang==='ro'?'Răspuns util':'Helpful answer',exact:true}).getAttribute('aria-pressed').then(v=>{if(v!=='true')throw Error('Feedback not reflected');});
  await page.getByRole('button',{name:lang==='ro'?'Regenerează răspunsul':'Regenerate answer',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ac-ai-answer').length===2);
  await textarea.fill('First line');await textarea.press('Shift+Enter');await textarea.type('Second line');if(!(await textarea.inputValue()).includes('\n'))throw Error('Shift Enter failed');
  await page.screenshot({path:path.join(dir,`conversation-${width}-${lang}.png`)});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Horizontal page overflow');
  const composer=await page.locator('.ac-ai-composer').boundingBox();if(composer.y+composer.height>height)throw Error('Composer outside viewport');
  await page.getByRole('button',{name:lang==='ro'?'Conversație nouă':'New chat',exact:true}).click();await textarea.fill('Second conversation');await textarea.press('Enter');await page.locator('.ac-ai-answer').waitFor();
  await page.getByRole('button',{name:lang==='ro'?'Istoric conversații':'Conversation history',exact:true}).click();if(await page.locator('.ac-ai-history-panel > button').count()!==2)throw Error('Conversation history missing');await page.getByRole('button',{name:lang==='ro'?'Închide':'Close',exact:true}).click();
  // Reload proves that persisted API history reconstructs sessions and feedback.
  await page.reload();await page.locator('.ac-ai-answer').waitFor();
  if(requests.filter(r=>r.path==='/api/v1/auto-assistant'&&r.method==='POST').some(r=>r.body.language!==lang))throw Error('Wrong request language');
  page.on('dialog',dialog=>dialog.accept());await page.locator('.ac-ai-actions-menu summary').click();await page.getByRole('button',{name:lang==='ro'?'Șterge conversația':'Delete conversation',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ac-ai-welcome'));
  if(turns.length!==2)throw Error('Delete removed a different conversation');
  if(errors.length)throw Error(errors.join(';'));
  results.push({width,height,language:lang,passed:true,bubbleWidth:Math.round(bubble.width),composerBottom:Math.round(composer.y+composer.height),apiRequests:requests.length});await page.close();
 }
 console.log(JSON.stringify({results,artifacts:dir},null,2));
}finally{await browser.close();server.close();}
