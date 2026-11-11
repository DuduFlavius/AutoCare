'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Languages } from 'lucide-react';
import SiteLanguage from './site-language';
export default function PublicLanguage() {
 const pathname = usePathname();
 const [language, setLanguage] = useState<'ro' | 'en'>('ro');
 useEffect(() => { try { const saved = localStorage.getItem('autocare-language'); const resolved = saved === 'en' || saved !== 'ro' && !navigator.language.toLowerCase().startsWith('ro') ? 'en' : 'ro'; setLanguage(resolved); if (!saved) localStorage.setItem('autocare-language', resolved); } catch { /* Local preference is optional. */ } }, []);
 if (['/autentificare','/inregistrare','/recuperare-parola','/resetare-parola'].includes(pathname)) return null;
 return <><SiteLanguage language={language}/><button type="button" className="ac-public-language" data-workspace-ui aria-label="Language / Limbă" onClick={() => { const next = language === 'en' ? 'ro' : 'en'; setLanguage(next); try { localStorage.setItem('autocare-language', next); } catch { /* Storage may be disabled. */ } }}><Languages size={16}/>{language === 'en' ? 'EN' : 'RO'}</button></>;
}
