'use client';
import './language-switch.css';
export default function LanguageMenu({language,onChange,compact=false}:{language:'ro'|'en';onChange:(language:'ro'|'en')=>void;compact?:boolean}) {
 return <div className={'ac-language-switch'+(compact?' is-compact':'')} role="group" aria-label={language==='en'?'Interface language':'Limba interfeței'} data-workspace-ui>{(['ro','en'] as const).map(code=><button key={code} type="button" lang={code} aria-label={code==='ro'?'Română':'English'} aria-pressed={language===code} onClick={()=>onChange(code)}>{code.toUpperCase()}</button>)}</div>;
}
