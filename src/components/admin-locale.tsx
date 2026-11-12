'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ApplicationLanguageProvider} from './application-locale';
import LanguageMenu from './language-menu';
import SiteLanguage from './site-language';
import {saveBrowserLanguage} from '@/lib/language-preference';
import './admin-premium.css';
export default function AdminLocale({children}:{children:ReactNode}){
 const [language,setLanguage]=useState<'ro'|'en'>('ro');
 const [error,setError]=useState('');
 useEffect(()=>{try{setLanguage(localStorage.getItem('autocare-language')==='en'?'en':'ro');}catch{/* Local preference is optional. */}},[]);
 const change=(next:'ro'|'en')=>{setLanguage(next);saveBrowserLanguage(next);window.dispatchEvent(new Event('autocare-language-change'));setError('');void fetch('/api/v1/preferences/language',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:next})}).then(r=>{if(!r.ok)throw Error();}).catch(()=>setError(next==='en'?'Language changed locally. Account preference could not be saved.':'Limba s-a schimbat local. Preferința contului nu s-a putut salva.'));};
 return <ApplicationLanguageProvider language={language}><div className="ac-admin-frame" data-language={language}><SiteLanguage language={language}/><div className="ac-admin-language" data-workspace-ui><span>AutoCare · {language==='en'?'Control center':'Centru de control'}</span><LanguageMenu language={language} onChange={change}/></div>{error&&<p role="alert" data-workspace-ui>{error}</p>}{children}</div></ApplicationLanguageProvider>;
}
