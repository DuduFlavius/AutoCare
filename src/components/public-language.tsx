'use client';
import {saveBrowserLanguage} from '@/lib/language-preference';
import {localizedPublicPath} from '@/lib/public-routes';
import {usePathname} from 'next/navigation';
import {useEffect} from 'react';
import LanguageMenu from './language-menu';
export default function PublicLanguage() {
 const pathname=usePathname();
 const language=pathname==='/en'||pathname.startsWith('/en/')?'en':'ro';
 const authPage=['/autentificare','/inregistrare','/recuperare-parola','/resetare-parola'].includes(pathname);
 useEffect(()=>{if(!authPage){saveBrowserLanguage(language);document.documentElement.lang=language;}},[language,authPage]);
 if(['/autentificare','/inregistrare','/recuperare-parola','/resetare-parola'].includes(pathname))return null;
 return <div className="ac-public-language" data-workspace-ui><LanguageMenu language={language} onChange={next=>{
  saveBrowserLanguage(next);
  const destination=localizedPublicPath(pathname,next);
  if(destination!==pathname)window.location.assign(destination+window.location.search+window.location.hash);
 }}/></div>;
}
