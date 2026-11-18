'use client';
import {useEffect,useState} from 'react';
import {MessageSquare,Star,X} from 'lucide-react';
import {useApplicationLanguage} from './application-locale';
import {hasNativeTracking,nativeTracking} from '@/lib/native-tracking';
export function FeedbackNotice({admin=false,preview=false,onOpen}:{admin?:boolean;preview?:boolean;onOpen:()=>void}){
 const en=useApplicationLanguage()==='en',[count,setCount]=useState(0);
 useEffect(()=>{if(preview)return;let disposed=false;async function load(){if(document.visibilityState!=='visible')return;try{const result=await fetch('/api/v1/feedback/notices');if(!result.ok)return;const out=await result.json();if(!disposed)setCount(out.count);}catch{/* The inbox remains reachable if the unread counter is offline. */}}void load();const timer=setInterval(()=>void load(),60000);window.addEventListener('autocare-feedback-updated',load);return()=>{disposed=true;clearInterval(timer);window.removeEventListener('autocare-feedback-updated',load);};},[preview]);
 return <button className="ac-feedback-entry" type="button" onClick={onOpen} data-workspace-ui><MessageSquare size={18}/><span>{admin?(en?'User feedback':'Feedback utilizatori'):(en?'Feedback & replies':'Feedback și răspunsuri')}</span>{count>0&&<b aria-label={en?'Unread updates':'Actualizări necitite'}>{count>=50?'50+':count}</b>}</button>;
}
export function FeedbackInvitation({enabled,userId,onOpen,preview=false}:{enabled:boolean;userId:string;onOpen:()=>void;preview?:boolean}){
 const en=useApplicationLanguage()==='en',[visible,setVisible]=useState(false),[dismissed,setDismissed]=useState(false);
 useEffect(()=>{
  if(!enabled||preview||dismissed){setVisible(false);return;}
  let disposed=false;const timer=setTimeout(async()=>{
   if(document.visibilityState!=='visible'||document.documentElement.dataset.autocareGpsActive==='true'||document.querySelector('[role="dialog"]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||''))return;
   try{
    if(localStorage.getItem('autocare-feedback-dismissed:'+userId))return;
    if(hasNativeTracking()&&(await nativeTracking.snapshot(userId))?.active)return;
    if(disposed)return;const response=await fetch('/api/v1/feedback/invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'shown'})});
    if(response.ok&&!disposed){const out=await response.json();setVisible(out.eligible===true);}
   }catch{/* An invitation never blocks the application. */}
  },45000);return()=>{disposed=true;clearTimeout(timer);setVisible(false);};
 },[enabled,userId,preview,dismissed]);
 if(!visible||!enabled)return null;
 function dismiss(){setVisible(false);setDismissed(true);try{localStorage.setItem('autocare-feedback-dismissed:'+userId,'1');}catch{/* Server preference remains authoritative. */}void fetch('/api/v1/feedback/invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dismiss'})}).catch(()=>{});}
 return <aside className="ac-feedback-invitation" aria-label={en?'Optional feedback invitation':'Invitație opțională de feedback'} data-workspace-ui><Star size={22}/><div><strong>{en?'How is AutoCare working for you?':'Cum ți se pare AutoCare?'}</strong><p>{en?'Your opinion helps us improve it.':'Părerea ta ne ajută să îl îmbunătățim.'}</p></div><button type="button" onClick={()=>{dismiss();onOpen();}}>{en?'Share feedback':'Trimite feedback'}</button><button type="button" onClick={dismiss} aria-label={en?'Do not ask again':'Nu mai afișa invitația'}><X size={19}/></button></aside>;
}
