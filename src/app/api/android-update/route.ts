import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){
  const headers={'Cache-Control':'public, max-age=0, s-maxage=30, stale-while-revalidate=30'};
  try {
    const release=JSON.parse(readFileSync(path.join(process.cwd(),'public/downloads/android-release.json'),'utf8'));
    if(!Number.isInteger(release.versionCode)||release.versionCode<1||typeof release.version!=='string'||typeof release.url!=='string'||!/^\/downloads\/AutoCare-[0-9.]+\.apk$/.test(release.url)||!existsSync(path.join(process.cwd(),'public',release.url)))throw Error('Installer unavailable');
    return Response.json({available:true,version:release.version,versionCode:release.versionCode,url:release.url},{headers});
  }catch{return Response.json({available:false},{headers});}
}
