'use client';
import {useEffect,useState} from 'react';
import {publicRoutePairs,romanianPublicPath} from '@/lib/public-routes';
import {displayBillingCurrency,type BillingCurrency} from '@/lib/billing-currency';
export function useBillingCurrency(language?:'ro'|'en') {
 const [publicLanguage,setPublicLanguage]=useState<'ro'|'en'>(language??'ro');
 const [currency,setCurrency]=useState<BillingCurrency>(language==='en'?'eur':'ron');
 useEffect(()=>{
  const update=()=>{
   try {
    const savedLanguage=localStorage.getItem('autocare-language');
    const publicPath=romanianPublicPath(window.location.pathname);
    const routeLanguage=publicPath&&publicRoutePairs[publicPath]?(window.location.pathname.startsWith('/en')?'en':'ro'):null;
    const resolved=language??routeLanguage??(savedLanguage==='en'||savedLanguage!=='ro'&&!navigator.language.toLowerCase().startsWith('ro')?'en':'ro');
    setPublicLanguage(resolved);
    const query=new URLSearchParams(window.location.search).get('currency')?.toLowerCase();
    const saved=localStorage.getItem('autocare-billing-currency-language')===resolved?localStorage.getItem('autocare-billing-currency'):null;
    setCurrency(displayBillingCurrency(resolved,query,saved));
   }catch{setPublicLanguage(language??'ro');setCurrency(language==='en'?'eur':'ron');}
  };
  update();
  for(const event of ['autocare-language-change','autocare-billing-currency-change','storage'])window.addEventListener(event,update);
  return()=>{for(const event of ['autocare-language-change','autocare-billing-currency-change','storage'])window.removeEventListener(event,update);};
 },[language]);
 const changeCurrency=(next:BillingCurrency)=>{
  setCurrency(next);
  try{localStorage.setItem('autocare-billing-currency',next);localStorage.setItem('autocare-billing-currency-language',language??publicLanguage);const url=new URL(window.location.href);url.searchParams.set('currency',next.toUpperCase());window.history.replaceState(window.history.state,'',url);window.dispatchEvent(new Event('autocare-billing-currency-change'));}catch{/* Checkout receives the selected currency even without storage. */}
 };
 return {currency,changeCurrency,en:(language??publicLanguage)==='en'};
}
