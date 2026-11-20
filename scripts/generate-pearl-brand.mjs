import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CarFront,Smartphone,Globe} from 'lucide-react';
import sharp from 'sharp';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const pearl='#F6F9FB',petrol='#075365',ink='#142333',muted='#657584';
const glyph=Icon=>renderToStaticMarkup(React.createElement(Icon,{color:petrol,strokeWidth:1.5})).replace(/<svg[^>]*>|<\/svg>/g,'');
const car=glyph(CarFront);
const svg=(size=192,transparent=false)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="${size}" height="${size}">${transparent?'':`<rect width="192" height="192" rx="38" fill="${pearl}"/>`}<g transform="translate(40 40) scale(4.6667)" fill="none" stroke="${petrol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${car}</g></svg>`;
await mkdir('public/brand',{recursive:true});await writeFile('public/brand/autocare-pearl-mark.svg',svg());await writeFile('public/favicon.svg',svg());
for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180],['favicon-96.png',96]])await sharp(Buffer.from(svg(size))).png().toFile('public/'+name);
const logo=await readFile('public/icon-192.png');await writeFile('src/lib/report-brand.ts',`// Generated from the same CarFront mark used by the app. Rebuild with scripts/generate-pearl-brand.mjs.\nexport const reportBrandLogo = '${logo.toString('base64')}';\n`);
// Immutable email image URLs prevent stale proxy copies in delivered mail.
const hero=`<svg xmlns="http://www.w3.org/2000/svg" width="1049" height="487"><rect width="1049" height="487" fill="${pearl}"/><rect x="32" y="28" width="985" height="431" rx="28" fill="white" stroke="#E3EBF0"/><g transform="translate(76 61) scale(2.4)" fill="none" stroke="${petrol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${car}</g><g font-family="DejaVu Sans, sans-serif"><text x="154" y="95" font-size="31" font-weight="bold" fill="${ink}">AutoCare</text><text x="155" y="121" font-size="17" fill="${petrol}">Premium</text><text x="76" y="214" font-size="45" font-weight="bold" fill="${ink}">Garajul tău digital.</text><text x="76" y="263" font-size="34" fill="${petrol}">Your digital garage.</text><text x="76" y="317" font-size="21" fill="${muted}">Documente · Întreținere · Cheltuieli</text><text x="76" y="351" font-size="18" fill="${muted}">Documents · Maintenance · Expenses</text><text x="76" y="410" font-size="18" fill="${petrol}">www.autocareapp.ro</text></g></svg>`;
const assets={};for(const [name,source] of [['hero',hero],['phone',`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${petrol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${glyph(Smartphone)}</svg>`],['globe',`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${petrol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${glyph(Globe)}</svg>`]]){
 const buffer=name==='hero'?await sharp(Buffer.from(source)).jpeg({quality:88}).toBuffer():await sharp(Buffer.from(source)).png().toBuffer();const hash=createHash('sha256').update(buffer).digest('hex').slice(0,12),path=`/email/${name==='hero'?'autocare-hero':name}-${hash}.${name==='hero'?'jpg':'png'}`;await writeFile('public'+path,buffer);assets[name]={path,width:name==='hero'?1049:96,height:name==='hero'?487:96};
}await writeFile('src/lib/email-assets.ts','/** Content-addressed Pearl assets: existing delivered emails keep their original images. */\nexport const emailAssets = '+JSON.stringify(assets,null,2)+' as const;\n');
const res='mobile/android/app/src/main/res';for(const d of await readdir(res,{withFileTypes:true})){
 if(!d.isDirectory())continue;const folder=res+'/'+d.name;
 for(const f of await readdir(folder)){
  if(!f.endsWith('.png')||!(f.startsWith('ic_launcher')||f==='splash.png'))continue;
  const path=folder+'/'+f,{width,height}=await sharp(path).metadata();
  if(f==='splash.png'){const size=Math.round(Math.min(width,height)*.27);await sharp({create:{width,height,channels:4,background:pearl}}).composite([{input:await sharp(Buffer.from(svg(size))).png().toBuffer(),gravity:'centre'}]).png().toFile(path+'.new');}
  else await sharp(Buffer.from(svg(width,f.includes('foreground')))).resize(width,height).png().toFile(path+'.new');
  await writeFile(path,await readFile(path+'.new'));await (await import('node:fs/promises')).unlink(path+'.new');
 }
}
// Android paths mirror the exact same lucide CarFront SVG paths.
const nativePaths=[...car.matchAll(/<path[^>]*d="([^"]+)"[^>]*>/g)].map(m=>`<path android:fillColor="#00000000" android:strokeColor="${petrol}" android:strokeWidth="1.5" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="${m[1]}"/>`).join('');
const circles=[...car.matchAll(/<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"/g)].map(m=>{const x=+m[1],y=+m[2],r=+m[3];return `<path android:fillColor="#00000000" android:strokeColor="${petrol}" android:strokeWidth="1.5" android:pathData="M${x-r},${y}a${r},${r} 0,1 0,${2*r},0a${r},${r} 0,1 0,-${2*r},0"/>`;}).join('');
await writeFile(res+'/drawable/autocare_launch_mark.xml',`<?xml version="1.0" encoding="utf-8"?><vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="120dp" android:height="120dp" android:viewportWidth="64" android:viewportHeight="64"><group android:translateX="12" android:translateY="12" android:scaleX="1.6667" android:scaleY="1.6667">${nativePaths}${circles}</group></vector>\n`);
for(const name of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png'])await sharp({create:{width:2732,height:2732,channels:4,background:pearl}}).composite([{input:await sharp(Buffer.from(svg(520))).png().toBuffer(),gravity:'centre'}]).png().toFile('mobile/ios/App/App/Assets.xcassets/Splash.imageset/'+name);
await sharp(Buffer.from(svg(1024))).png().toFile('mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
await writeFile('mobile/ios/App/App/Assets.xcassets/LaunchMark.imageset/autocare.svg',svg(512));
console.log('Generated shared Pearl mark, web/native icons, launch images and immutable email assets.');
