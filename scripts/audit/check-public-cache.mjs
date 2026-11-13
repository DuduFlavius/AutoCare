import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicRoutePairs} from '../../src/lib/public-routes.ts';
const manifest=JSON.parse(await readFile('.next/prerender-manifest.json','utf8'));
const auth=new Set(['/autentificare','/inregistrare','/recuperare-parola','/resetare-parola']);
const publicPaths=Object.entries(publicRoutePairs).filter(([ro])=>!auth.has(ro)).flat();
for(const path of publicPaths){assert.ok(manifest.routes[path],`Public page is not prerendered: ${path}`);assert.equal(manifest.routes[path].initialRevalidateSeconds,300,path);}
for(const [ro,en] of Object.entries(publicRoutePairs).filter(([ro])=>auth.has(ro))){assert.ok(!manifest.routes[ro],ro);assert.ok(!manifest.routes[en],en);}
for(const path of Object.keys(manifest.routes))assert.doesNotMatch(path,/^\/(?:cont|admin|dosar|api)(?:\/|$)/,'Private route in static HTML cache');
console.log(JSON.stringify({publicPagesPrerendered:publicPaths.length,revalidateSeconds:300,privatePagesPrerendered:0}));
