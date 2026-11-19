'use client';
import {useState} from 'react';
import {Headset,Mail,HelpCircle,MessageSquare,History,ChevronLeft} from 'lucide-react';
import {useApplicationLanguage} from '../application-locale';
import SupportChat from '../support-chat';
export function RacingSupport({role,preview,onFeedback}:{role:string;preview:boolean;onFeedback:()=>void}){
 const en=useApplicationLanguage()==='en',[chat,setChat]=useState(false);
 if(chat)return <div><button onClick={()=>setChat(false)}><ChevronLeft size={18}/>{en?'Support center':'Centrul de suport'}</button><SupportChat role={role} preview={preview} onFeedback={onFeedback}/></div>;
 return <section className="rg-support-home"><article className="rg-support-hero"><Headset size={52}/><h2>{en?'AutoCare assistance':'Asistență AutoCare'}</h2><p>{en?'Send our team a message and follow your conversation here.':'Scrie echipei și urmărește conversația aici.'}</p><button className="primary" onClick={()=>setChat(true)}><MessageSquare size={19}/>{en?'Open support chat':'Deschide chatul'}</button></article><div className="rg-support-links"><details><summary><HelpCircle size={20}/> FAQ</summary><h3>{en?'How do I add a document?':'Cum adaug un document?'}</h3><p>{en?'Open Documents, choose your vehicle and select Upload document.':'Deschide Documente, alege mașina și apasă Încarcă document.'}</p><h3>{en?'Where are my reports?':'Unde sunt rapoartele?'}</h3><p>{en?'Open Reports to filter your records and export PDF or CSV with Premium.':'Deschide Raport pentru a filtra înregistrările și a exporta PDF sau CSV cu Premium.'}</p></details><button onClick={()=>setChat(true)}><History size={22}/>{en?'Conversation history':'Istoric conversații'}</button><button onClick={onFeedback}><Mail size={22}/>{en?'Contact & feedback':'Contact și feedback'}</button></div></section>;
}
