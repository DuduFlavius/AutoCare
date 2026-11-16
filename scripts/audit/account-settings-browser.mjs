/** Real account-settings component with synthetic data and isolated network responses. */
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),'autocare-account-visual-'));
const site=await readFile('src/components/site-document.tsx','utf8'),dashboard=await readFile('src/components/dashboard.tsx','utf8');
const css=[...(site.match(/import '@\/app\/[^']+\.css';/g)||[]).map(line=>line.replace('@/',root+'/src/')),...(dashboard.match(/import '\.\/[^']+\.css';/g)||[]).map(line=>line.replace('./',root+'/src/components/'))].join('\n');
await writeFile(path.join(dir,'entry.tsx'),`import React from '${root}/node_modules/react/index.js';import{createRoot}from'${root}/node_modules/react-dom/client.js';import AccountSettings from '${root}/src/components/account-settings.tsx';import{ApplicationLanguageProvider}from'${root}/src/components/application-locale.tsx';${css}
const en=new URLSearchParams(location.search).get('lang')==='en';createRoot(document.getElementById('root')).render(<ApplicationLanguageProvider language={en?'en':'ro'}><div className="app-shell ac-workspace ac-studio ac-reference-theme"><main className="main" id="workspace-main"><div className="ws-settings-layout ac-settings-premium"><nav className="ws-settings-nav"><button aria-current="page">{en?'Account Settings':'Setări cont'}</button><button>{en?'Notifications & email':'Notificări și email'}</button><button>{en?'App & display':'Aplicație și afișare'}</button><button>{en?'Help':'Ajutor'}</button></nav><div className="grid2 settings-workspace"><section><AccountSettings preview={false} onUpdated={async()=>{document.body.dataset.updated='true';}} onDelete={()=>{document.body.dataset.deleteRequested='true';}}/></section></div></div></main></div></ApplicationLanguageProvider>);`);
await build({entryPoints:[path.join(dir,'entry.tsx')],bundle:true,outfile:path.join(dir,'app.js'),absWorkingDir:root,tsconfig:path.join(root,'tsconfig.json'),jsx:'automatic',nodePaths:[path.join(root,'node_modules')],external:['/images/*','/mobile-reference/*','/dashboard-reference/*'],loader:{'.woff2':'dataurl','.woff':'dataurl','.png':'dataurl','.svg':'dataurl'},logLevel:'error'});
const html='<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>html,body{margin:0;background:#090f20}.app-shell{display:block!important}.app-shell main.main#workspace-main{position:static!important;margin:0!important;padding:32px!important;width:100%!important;max-width:100%!important;min-height:100vh!important;box-sizing:border-box!important}@media(max-width:620px){.app-shell main.main#workspace-main{padding:14px!important}}</style><div id="root"></div><script src="/app.js"></script></html>';
const server=http.createServer(async(req,res)=>{const file=req.url.split('?')[0];res.setHeader('Content-Type',file==='/app.js'?'application/javascript':file==='/app.css'?'text/css':'text/html');res.end(file==='/app.js'||file==='/app.css'?await readFile(path.join(dir,file.slice(1))):html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.AUTOCARE_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const [width,height,lang] of [[1440,1000,'ro'],[1024,900,'ro'],[390,844,'ro'],[360,740,'en']]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],calls=[];
  const account={firstName:'Alexandru',lastName:'Popescu',name:'Alexandru Popescu',email:'alexandru.popescu.test@example.invalid',emailVerified:true,createdAt:'2026-11-01T12:00:00.000Z',providers:['credential'],alerts:{itp:true,rca:true,rovinieta:true,service:true,chat:true,updates:true,account:true}};
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>{const request=route.request(),url=new URL(request.url());calls.push({path:url.pathname,method:request.method()});
   if(url.pathname==='/api/v1/account/settings')return route.fulfill({json:account});
   if(url.pathname.endsWith('/list-sessions'))return route.fulfill({json:[{token:'isolated-test-token',userAgent:'Android · Chrome · test fixture',createdAt:'2026-11-01T12:00:00.000Z',expiresAt:'2026-12-01T12:00:00.000Z'}]});
   if(url.pathname.endsWith('/get-session'))return route.fulfill({json:null});
   return route.fulfill({json:{status:true,user:{id:'test',name:account.name,email:account.email}}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/?lang='+lang);
  await page.getByRole('button',{name:lang==='en'?/Personal information/:/Informații personale/}).waitFor();
  await page.screenshot({path:path.join(dir,`settings-${width}-${lang}.png`),fullPage:true});
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,cards:[...document.querySelectorAll('.ac-account-menu:not([hidden]) .ac-settings-group-rows')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})}));
  if(layout.overflow)throw Error('Horizontal page overflow at '+width);
  for(const card of layout.cards)if(card.x<0||card.x+card.width>width+1)throw Error('Card outside viewport');
  for(let i=0;i<layout.cards.length;i++)for(let j=i+1;j<layout.cards.length;j++){const a=layout.cards[i],b=layout.cards[j];if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1)throw Error('Overlapping account cards');}
  await page.getByRole('button',{name:lang==='en'?/Personal information/:/Informații personale/}).click();
  await page.locator('.ac-account-profile input[name=displayName]').waitFor();
  await page.getByRole('button',{name:lang==='en'?'All settings':'Toate setările',exact:true}).click();
  await page.getByRole('button',{name:lang==='en'?/^Email & password/:/^Email și parolă/}).click();
  const summaries=page.locator('.ac-account-edit-panel>summary');await summaries.nth(0).click();await page.getByRole('textbox',{name:lang==='en'?'New email address':'Adresa nouă de email',exact:true}).fill('new-address@example.invalid');
  await page.getByRole('button',{name:lang==='en'?'Request email change':'Solicită schimbarea emailului',exact:true}).click();await page.getByRole('status').waitFor();
  await summaries.nth(1).click();const next=page.locator('input[name=next]'),confirm=page.locator('input[name=confirm]');await page.locator('input[name=current]').fill('current-password');await next.fill('new-password-123');await confirm.fill('different-password');
  await page.getByRole('button',{name:lang==='en'?'Change password':'Schimbă parola',exact:true}).click();await page.getByRole('alert').waitFor();
  if(calls.some(call=>call.path.endsWith('/change-password')))throw Error('Mismatched passwords reached API');
  await page.getByRole('checkbox',{name:lang==='en'?'Show passwords':'Afișează parolele',exact:true}).check();if(await next.getAttribute('type')!=='text')throw Error('Password visibility failed');
  await page.getByRole('button',{name:lang==='en'?'All settings':'Toate setările',exact:true}).click();
  await page.getByRole('button',{name:lang==='en'?/Devices & sessions/:/Dispozitive și sesiuni/}).click();
  await page.getByRole('button',{name:lang==='en'?'View active sessions':'Vezi sesiunile active',exact:true}).click();await page.locator('.ac-account-sessions li').waitFor();
  await page.getByRole('button',{name:lang==='en'?'All settings':'Toate setările',exact:true}).click();
  await page.getByRole('button',{name:lang==='en'?/^Delete account Information/:/^Ștergerea contului Informații/}).click();
  await page.getByRole('button',{name:lang==='en'?'Delete Account':'Șterge definitiv contul',exact:true}).click();if(!await page.evaluate(()=>document.body.dataset.deleteRequested==='true'))throw Error('Deletion confirmation did not open');
  if(calls.some(call=>call.method==='DELETE'))throw Error('Delete button bypassed confirmation');
  if(errors.length)throw Error(errors.join(';'));
  await page.screenshot({path:path.join(dir,`expanded-${width}-${lang}.png`),fullPage:true});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Expanded form overflow');
  results.push({width,height,language:lang,passed:true,cards:layout.cards.length,requests:calls.length});await page.close();
 }
 console.log(JSON.stringify({results,artifacts:dir,scope:'Real component, synthetic data and API responses. No production account mutations.'},null,2));
}finally{await browser.close();server.close();}
