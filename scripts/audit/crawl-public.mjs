import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const [base='http://127.0.0.1:3000',output='/tmp/autocare-crawl.json']=process.argv.slice(2);
const {publicRoutePairs}=await import('../../src/lib/public-routes.ts');
const paths=[...new Set([...Object.keys(publicRoutePairs),...Object.values(publicRoutePairs),'/robots.txt','/sitemap.xml','/llms.txt','/api/app-version'])];
const result=[];let cursor=0;
async function worker(){while(cursor<paths.length){const path=paths[cursor++];const start=performance.now();try{
 const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(25000),redirect:'follow',headers:{'User-Agent':'AutoCare-Authorized-Audit/1.0'}});const html=await response.text();
 const attr=(tag,name)=>{const match=html.match(new RegExp('<'+tag+'[^>]*'+name+'="([^"]*)"','i'));return match?.[1]??null;};
 const links=[...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(x=>x[1].replaceAll('&amp;','&')).filter(x=>x.startsWith('/')&&!x.startsWith('//'));
 const findLink=(rel)=>[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]).find(x=>x.includes('rel="'+rel+'"'))?.match(/href="([^"]+)"/)?.[1]??null;
 result.push({path,status:response.status,finalURL:response.url,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(html),title:html.match(/<title>(.*?)<\/title>/s)?.[1]??null,h1s:(html.match(/<h1\b/g)||[]).length,description:html.match(/<meta name="description" content="([^"]*)"/)?.[1]??null,canonical:findLink('canonical'),lang:attr('html','lang'),hreflang:(html.match(/hrefLang=/gi)||[]).length,robots:html.match(/<meta name="robots" content="([^"]*)"/)?.[1]??response.headers.get('x-robots-tag'),links});
 }catch(error){result.push({path,error:error.name});}}}
await Promise.all([worker(),worker(),worker()]);
result.sort((a,b)=>a.path.localeCompare(b.path));await writeFile(output,JSON.stringify({base,checkedAt:new Date().toISOString(),pages:result},null,2));
console.log(JSON.stringify({checked:result.length,errors:result.filter(x=>x.error||x.status!==200).map(x=>({path:x.path,status:x.status,error:x.error})),output}));
