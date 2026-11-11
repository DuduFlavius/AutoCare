'use client';
import { Globe2, ChevronDown } from 'lucide-react';
export default function LanguageMenu({language,onChange,compact=false}:{language:'ro'|'en';onChange:(language:'ro'|'en')=>void;compact?:boolean}) {
 return <label className={'ac-language-menu'+(compact?' is-compact':'')} data-workspace-ui><Globe2 size={16} aria-hidden="true"/>{!compact&&<span>{language==='en'?'Language':'Limbă'}</span>}<select aria-label={language==='en'?'Interface language':'Limba interfeței'} value={language} onChange={e=>onChange(e.target.value as 'ro'|'en')}><option value="ro">{compact?'RO':'RO · Română'}</option><option value="en">{compact?'EN':'EN · English'}</option></select><ChevronDown size={13} aria-hidden="true"/></label>;
}
