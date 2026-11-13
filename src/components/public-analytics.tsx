'use client';
import {useEffect,useState} from 'react';
import Script from 'next/script';
import {usePathname} from 'next/navigation';
import {analyticsEventAllowed,analyticsMeasurementId} from '@/lib/analytics';
import {useApplicationLanguage} from './application-locale';
const KEY='autocare-analytics-consent-v1';
type Gtag=(...args:unknown[])=>void;
export default function PublicAnalytics(){
 const id=analyticsMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
 const en=useApplicationLanguage()==='en';const pathname=usePathname();
 const [consent,setConsent]=useState<'unknown'|'granted'|'denied'>('unknown');const [ready,setReady]=useState(false);
 useEffect(()=>{try{const value=localStorage.getItem(KEY);if(value==='granted'||value==='denied')setConsent(value);}catch{/* Analytics stays off. */}},[]);
 useEffect(()=>{
  if(!id||consent!=='granted'||!ready)return;
  const target=window as Window&{dataLayer?:unknown[];gtag?:Gtag};
  target.dataLayer??=[];target.gtag??=function(...args){target.dataLayer!.push(args);};
  target.gtag('js',new Date());target.gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+pathname,page_referrer:document.referrer?new URL(document.referrer).origin:'',page_title:pathname});
  target.gtag('event','page_view',{page_location:location.origin+pathname,page_path:pathname,page_title:pathname});
  const conversion=(event:Event)=>{const name=(event as CustomEvent).detail;if(typeof name==='string'&&analyticsEventAllowed(name))target.gtag?.('event',name,{method:'email'});};
  window.addEventListener('autocare-public-conversion',conversion);return()=>window.removeEventListener('autocare-public-conversion',conversion);
 },[id,consent,ready,pathname]);
 if(!id)return null;
 const choose=(value:'granted'|'denied')=>{setConsent(value);try{localStorage.setItem(KEY,value);}catch{/* Current page only. */}if(value==='denied'&&ready)window.location.reload();};
 return <section className="card ac-analytics-consent" aria-label={en?'Analytics preferences':'Preferințe de analiză'}>
 {consent==='unknown'?<><p>{en?'Allow optional audience measurement? No account identifiers, documents or form contents are sent.':'Permiți măsurarea opțională a audienței? Nu trimitem identificatori de cont, documente sau conținutul formularelor.'}</p><div className="actions"><button type="button" onClick={()=>choose('granted')}>{en?'Accept analytics':'Acceptă analiza'}</button><button type="button" onClick={()=>choose('denied')}>{en?'Continue without analytics':'Continuă fără analiză'}</button></div></>:<button type="button" onClick={()=>{if(consent==='granted')choose('denied');else setConsent('unknown');}}>{en?'Analytics preferences':'Preferințe de analiză'}</button>}
 {consent==='granted'&&<Script src={'https://www.googletagmanager.com/gtag/js?id='+id} strategy="afterInteractive" onReady={()=>setReady(true)}/>}
 </section>;
}
