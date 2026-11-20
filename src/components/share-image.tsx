import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const alt='AutoCare Premium — garaj digital, documente, întreținere și cheltuieli.';
export const size={width:1200,height:630};
export const contentType='image/png';
export const dynamic='force-static';
export default async function Image(language:'ro'|'en'='ro'){
 const art=await readFile(path.join(process.cwd(),`public/images/autocare-racing-green-preview${language==='en'?'-en':''}.png`));
 return new Response(new Uint8Array(art),{headers:{'Content-Type':contentType,'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
}
