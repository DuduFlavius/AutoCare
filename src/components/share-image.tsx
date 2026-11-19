import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
export const alt='AutoCare Premium — garaj digital, documente, întreținere și kilometraj.';
export const size={width:1200,height:630};
export const contentType='image/png';
export const dynamic='force-static';
export default async function Image(language:'ro'|'en'='ro'){
 const en=language==='en';
 const [art,logo]=await Promise.all([readFile(path.join(process.cwd(),'public/images/autocare-app-premium.webp')).then(data=>sharp(data).resize(1200,675).png().toBuffer()),readFile(path.join(process.cwd(),'public/icon-192.png'))]);
 return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',position:'relative',background:'#101A16',color:'#edf4ff',fontFamily:'sans-serif'}}>
  <img src={'data:image/png;base64,'+art.toString('base64')} width={1200} height={675} alt="" style={{position:'absolute',left:0,top:-22,objectFit:'cover'}}/>
  <div style={{position:'absolute',left:0,top:0,width:1200,height:630,display:'flex',background:'linear-gradient(90deg,rgba(5,15,34,0.97) 0%,rgba(5,15,34,0.94) 36%,rgba(5,15,34,0.52) 62%,rgba(5,15,34,0.08) 100%)'}}/>
  <div style={{position:'relative',display:'flex',flexDirection:'column',padding:'48px 58px',width:760}}>
   <div style={{display:'flex',alignItems:'center',gap:15}}><img src={'data:image/png;base64,'+logo.toString('base64')} width={52} height={52} alt="" style={{borderRadius:14}}/><span style={{fontSize:34,fontWeight:700,letterSpacing:-1}}>AutoCare</span><span style={{fontSize:11,letterSpacing:3,color:'#71E5BB',marginLeft:3,marginTop:6}}>PREMIUM</span></div>
   <div style={{display:'flex',flexDirection:'column',fontSize:66,fontWeight:700,lineHeight:1.06,letterSpacing:-2,marginTop:65}}><span>{en?'Your car.':'Mașina ta.'}</span><span style={{color:'#71E5BB',marginTop:9}}>{en?'All in one place.':'Totul sub control.'}</span></div>
   <p style={{fontSize:22,color:'#F3F8F5',lineHeight:1.5,maxWidth:560,margin:'28px 0 0'}}>{en?'Documents, maintenance and mileage. Your digital garage, wherever you are.':'Documente, întreținere și kilometraj. Garajul tău digital, oriunde te-ai afla.'}</p>
   <div style={{display:'flex',alignItems:'center',marginTop:'auto',gap:18,fontSize:15,color:'#34C997'}}><span>www.autocareapp.ro</span><span style={{color:'#34C997'}}>·</span><span>Android & Web</span></div>
  </div>
 </div>,{...size,headers:{'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
}
