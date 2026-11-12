'use client';
import {saveBrowserLanguage} from '@/lib/language-preference';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import LanguageMenu from './language-menu';
import SiteLanguage from './site-language';
export default function PublicLanguage() {
 const pathname = usePathname();
 const [language, setLanguage] = useState<'ro' | 'en'>('ro');
 useEffect(() => { try { const saved = localStorage.getItem('autocare-language'); const resolved = saved === 'en' || saved !== 'ro' && !navigator.language.toLowerCase().startsWith('ro') ? 'en' : 'ro'; setLanguage(resolved); saveBrowserLanguage(resolved); } catch { /* Local preference is optional. */ } }, []);
 if (['/autentificare','/inregistrare','/recuperare-parola','/resetare-parola'].includes(pathname)) return null;
 return <><SiteLanguage language={language}/><div className="ac-public-language" data-workspace-ui><LanguageMenu language={language} onChange={next => { setLanguage(next); try { saveBrowserLanguage(next); window.dispatchEvent(new Event('autocare-language-change')); } catch { /* Storage may be disabled. */ } }}/></div></>;
}
