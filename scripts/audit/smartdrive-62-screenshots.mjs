import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {chromium}=createRequire(process.env.AUTOCARE_QA_PLAYWRIGHT)('playwright');
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const destination=process.env.AUTOCARE_QA_SCREENSHOTS;
const before='http://127.0.0.1:4171', after='http://127.0.0.1:4172';
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(before+'/home.html');
 await page.getByText('QA 62 SD',{exact:false}).first().waitFor();
 await page.screenshot({path:destination+'/01-dashboard-before.png',fullPage:true});
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:844});
  await page.goto(after+'/home.html');
  const card=page.getByRole('button',{name:'Deschide SmartDrive',exact:true});
  await card.waitFor();
  const box=await card.boundingBox();
  assert.ok(box&&box.height>=90&&box.height<=120);
  assert.ok(await page.getByRole('button',{name:'Deschide fișa mașinii'}).evaluate((vehicle,y)=>vehicle.getBoundingClientRect().top+scrollY<y,box.y));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`Horizontal overflow at ${width}px`);
  if(width===390||width===1440)await page.screenshot({path:`${destination}/dashboard-after-${width}.png`,fullPage:true});
  await card.click();
  assert.equal(await page.locator('html').getAttribute('data-last-destination'),'Plan întreținere');
  for(const [label,tab] of [['Kilometraj Istoric și statistici','Kilometraj'],['Service Plan și istoric','Întreținere'],['Documente ITP, RCA, CASCO','Documente'],['Cheltuieli Costuri și rapoarte','Cheltuieli']]){
   await page.getByRole('button',{name:label,exact:true}).click();
   assert.equal(await page.locator('html').getAttribute('data-last-destination'),tab);
  }
 }
 await page.goto(after+'/home.html?web=1');
 assert.equal(await page.getByRole('button',{name:'Deschide SmartDrive'}).count(),0);
 await page.setViewportSize({width:390,height:844});
 for(const [label,url] of [['before',before],['after',after]]){
  await page.goto(url+'/frame.html?state=guiding');
  const map=page.locator('.ac-road-map canvas.maplibregl-canvas');
  await map.waitFor({timeout:25000});
  await page.waitForFunction(()=>!document.querySelector('.ac-road-map [role=status]')?.textContent?.includes('Se încarcă'),{},{timeout:20000});
  const theme=page.getByRole('button',{name:'Tema hărții'});
  await theme.click();
  await page.locator('[data-map-theme="day"]').waitFor();
  await page.screenshot({path:`${destination}/map-${label}-day.png`});
  await theme.click();
  await page.locator('[data-map-theme="night"]').waitFor();
  await page.screenshot({path:`${destination}/map-${label}-night.png`});
 }
 console.log('Home, Android-only shortcut, four navigation actions, five viewport widths and the map theme switches passed.');
} finally {await browser.close();}
