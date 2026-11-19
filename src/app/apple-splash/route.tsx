import {ImageResponse} from 'next/og';
import {appleLaunchScreens} from '@/lib/pwa-launch';
import assets from '@/lib/report-assets.json';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams,w=Number(query.get('w')),h=Number(query.get('h'));
 if(!appleLaunchScreens.some(size=>size.w===w&&size.h===h))return new Response('Unsupported screen',{status:400});
 return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#020b09',color:'#edf0ff',alignItems:'center',justifyContent:'center',flexDirection:'column'}}><img src={'data:image/png;base64,'+assets.logo} width={w*.17} height={w*.17} alt=""/><div style={{display:'flex',fontSize:w*.076,fontWeight:700,marginTop:w*.035}}>AutoCare</div><div style={{display:'flex',fontSize:w*.028,color:'#00e6a0',letterSpacing:w*.008,marginTop:w*.015}}>PREMIUM</div></div>,{width:w,height:h,headers:{'Cache-Control':'public, max-age=86400','X-Robots-Tag':'noindex'}});
}
