'use client';
import {useState} from 'react';
import {HelpCircle, Mail, ChevronLeft} from 'lucide-react';
import {useApplicationLanguage} from '../application-locale';
import SupportChat from '../support-chat';
import './reference-support.css';
export function RacingSupport({role,preview,onFeedback}:{role:string;preview:boolean;onFeedback:()=>void}){
 const en=useApplicationLanguage()==='en';
 const [tab,setTab]=useState<'chat'|'requests'|'faq'>('chat');
 const staff=['assistant','admin','founder','superadmin'].includes(role);
 return <section className="ac-support-page ac-reference-support">
  <header className="ac-support-title"><a href="/cont?tab=Dashboard" aria-label={en?'Back to Home':'Înapoi la Acasă'}><ChevronLeft size={22}/></a><div><h2>{en?'Support':'Suport'}</h2><p>{en?'Help center':'Centrul de asistență'}</p></div></header>
  <nav className="ac-support-tabs" aria-label={en?'Support sections':'Secțiuni suport'}>
   <button type="button" aria-pressed={tab==='chat'} onClick={()=>setTab('chat')}>{en?'Conversation':'Conversație'}</button>
   {!staff&&<button type="button" aria-pressed={tab==='requests'} onClick={()=>setTab('requests')}>{en?'My requests':'Cererile mele'}</button>}
   <button type="button" aria-pressed={tab==='faq'} onClick={()=>setTab('faq')}>{en?'FAQ':'Întrebări frecvente'}</button>
  </nav>
  <div hidden={tab==='faq'} className="ac-support-conversation"><SupportChat role={role} preview={preview} onFeedback={onFeedback} historyView={tab==='requests'} onOpenConversation={()=>setTab('chat')}/></div>
  {tab==='faq'&&<div className="ac-support-faq"><details><summary><HelpCircle size={20}/>{en?'How do I add a document?':'Cum adaug un document?'}</summary><p>{en?'Open Documents, select your vehicle and choose Add document.':'Deschide Documente, selectează mașina și apasă Adaugă document.'}</p></details><details><summary><HelpCircle size={20}/>{en?'Where are my reports?':'Unde sunt rapoartele?'}</summary><p>{en?'Open Reports to filter your records and export PDF or CSV with Premium.':'Deschide Rapoarte pentru a filtra înregistrările și a exporta PDF sau CSV cu Premium.'}</p></details><button type="button" onClick={onFeedback}><Mail size={19}/>{en?'Contact and feedback':'Contact și feedback'}</button></div>}
 </section>;
}
