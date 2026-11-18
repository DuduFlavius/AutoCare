import {notFound} from 'next/navigation';
import {renderEmail} from '@/lib/email-templates';
import {origin} from '@/lib/config';
export const dynamic='force-dynamic';
export const metadata={title:'AutoCare — previzualizare email',robots:{index:false,follow:false}};
export default async function EmailPreview({searchParams}:{searchParams:Promise<{device?:string;lang?:string}>}){
 if(process.env.VERCEL_ENV==='production'||process.env.RENDER==='true')notFound();
 const params=await searchParams,language=params.lang==='en'?'en':'ro',width=params.device==='phone'?390:600;
 const html=renderEmail('administrative',{name:'Flavius Dudu',language}).html.replaceAll(origin()+'/email-','/email-').replaceAll('http://localhost:3000','https://www.autocareapp.ro');
 return <main style={{padding:'24px 8px',background:'#edf1f7',minHeight:'100vh'}}><p style={{textAlign:'center',color:'#24243b'}}>AutoCare · Email · Date fictive · {width}px</p><iframe title="AutoCare email preview" srcDoc={html} style={{display:'block',border:0,width,maxWidth:'100%',height:1000,margin:'auto'}}/></main>;
}
