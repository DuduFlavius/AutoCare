'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle,Info,LoaderCircle} from 'lucide-react';

import {ConfirmationQueue,type ConfirmationRequest as Request} from '@/lib/confirmation-queue';
const queue=new ConfirmationQueue();
export function requestConfirmation(message:string,action?:()=>Promise<void>):Promise<boolean>{
 if(typeof window==='undefined')return Promise.resolve(false);
 const language=(document.querySelector<HTMLElement>('[data-language]')?.dataset.language||document.documentElement.lang).startsWith('en')?'en':'ro';
 return queue.request(message,language,action);
}
function settle(value:boolean){queue.settle(value);}
export function PremiumDialogHost(){
 const [request,setRequest]=useState<Request|null>(null),[working,setWorking]=useState(false),[error,setError]=useState(''),actionLock=useRef(false),root=useRef<HTMLDivElement>(null),id=useId();
 useEffect(()=>queue.subscribe(setRequest),[]);
 useEffect(()=>{
  if(!request)return;
  setError('');
  const previous=document.activeElement as HTMLElement|null;
  const siblings=Array.from(document.body.children).filter(node=>node!==root.current?.parentElement&&node instanceof HTMLElement) as HTMLElement[];
  const states=siblings.map(node=>({node,inert:node.inert}));states.forEach(({node})=>{node.inert=true;});
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';root.current?.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{states.forEach(({node,inert})=>{node.inert=inert;});document.body.style.overflow=oldOverflow;previous?.focus({preventScroll:true});};
 },[request]);
 async function confirm(){if(actionLock.current||!request)return;if(!request.action){settle(true);return;}actionLock.current=true;setWorking(true);setError('');try{await request.action();settle(true);}catch(cause){setError(cause instanceof Error?cause.message:request.language==='en'?'Action failed. Please try again.':'Acțiunea a eșuat. Reîncearcă.');}finally{actionLock.current=false;setWorking(false);}}
 if(!request)return null;
 const en=request.language==='en',message=request.message;
 const destructive=/șterg|delete|discard|renunț|abandon|archive|arhiv|revoc|remove/i.test(message);
 const label=/șterg|delete/i.test(message)?(en?'Delete':'Șterge'):/arhiv|archive/i.test(message)?(en?'Archive':'Arhivează'):/renunț|discard|abandon/i.test(message)?(en?'Discard changes':'Renunță la modificări'):/deconect|sign out/i.test(message)?(en?'Sign out':'Deconectează'):/salvez|salvezi|save/i.test(message)?(en?'Save':'Salvează'):/închei|end this/i.test(message)?(en?'End conversation':'Încheie conversația'):(en?'Confirm':'Confirmă');
 return createPortal(<div className="ac-confirm-overlay"><div className="ac-premium-dialog" role="alertdialog" aria-modal="true" aria-labelledby={id+'-title'} aria-describedby={id+'-body'} ref={root} onKeyDown={event=>{
  event.stopPropagation();if(event.key==='Escape'){event.preventDefault();if(!actionLock.current)settle(false);}if(event.key==='Tab'){const nodes=Array.from(root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 }}><span className="ac-dialog-symbol" data-danger={destructive}>{destructive?<AlertTriangle size={24}/>:<Info size={24}/>}</span><h2 id={id+'-title'}>{message.includes('?')?message.slice(0,message.indexOf('?')+1):(en?'Confirm action':'Confirmă acțiunea')}</h2><p id={id+'-body'}>{message}</p>{error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={working} onClick={()=>{setError('');settle(false);}}>{en?'Cancel':'Anulează'}</button><button type="button" className={destructive?'ac-dialog-danger':'ac-dialog-confirm'} disabled={working} aria-busy={working} onClick={()=>void confirm()}>{working?<><LoaderCircle size={17}/>{en?'Processing…':'Se procesează…'}</>:label}</button></footer></div></div>,document.body);
}
