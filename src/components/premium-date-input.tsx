'use client';
import {useEffect,useRef,useState,type InputHTMLAttributes,type ChangeEvent} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {useApplicationLanguage} from './application-locale';
import {validDateValue} from '@/lib/control-validation';
import {calendarCells} from '@/lib/document-presentation';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'> & {type?:'date'|'month'|'datetime-local'};
export function PremiumDateInput({type='date',value,defaultValue,onChange,...props}:Props){
 const en=useApplicationLanguage()==='en',t=(ro:string,english:string)=>en?english:ro;
 const [local,setLocal]=useState(String(defaultValue??'')),[open,setOpen]=useState(false),[view,setView]=useState<'days'|'months'|'years'>(type==='month'?'months':'days');
 const current=String(value??local),input=useRef<HTMLInputElement>(null),panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const initial=()=>{const parsed=/^\d{4}-\d{2}/.test(current)?new Date(current.slice(0,7)+'-01T12:00:00Z'):new Date();return Number.isFinite(parsed.getTime())?parsed:new Date();};
 const [month,setMonth]=useState(initial),[position,setPosition]=useState({top:80,left:8,maxHeight:480});
 useEffect(()=>{const form=input.current?.form;if(!form)return;const reset=()=>setLocal(String(defaultValue??''));form.addEventListener('reset',reset);return()=>form.removeEventListener('reset',reset);},[defaultValue]);
 const year=month.getUTCFullYear(),monthIndex=month.getUTCMonth(),locale=en?'en-GB':'ro-RO';
 useEffect(()=>{
  if(!open)return;
  const place=()=>{const r=input.current!.getBoundingClientRect(),height=window.visualViewport?.height??window.innerHeight,width=Math.min(336,window.innerWidth-16);const panelHeight=panel.current?.getBoundingClientRect().height??405;setPosition({top:Math.max(8,Math.min(r.bottom+6,height-panelHeight-8)),left:Math.max(8,Math.min(r.left,window.innerWidth-width-8)),maxHeight:Math.max(150,height-16)});};
  place();const frame=requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('button[aria-pressed=true],button')?.focus());
  const close=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',close,true);window.visualViewport?.addEventListener('resize',place);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',close,true);window.visualViewport?.removeEventListener('resize',place);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open]);
 useEffect(()=>{input.current?.setCustomValidity(validDateValue(current,type,props.min?String(props.min):undefined,props.max?String(props.max):undefined)?'':t('Introdu o dată validă în intervalul permis.','Enter a valid date within the allowed range.'));},[current,type,props.min,props.max,en]);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const select=(iso:string)=>{
  const next=type==='month'?iso.slice(0,7):type==='datetime-local'?iso+'T'+(current.split('T')[1]||'09:00'):iso;
  if(!validDateValue(next,type,props.min?String(props.min):undefined,props.max?String(props.max):undefined))return;
  if(input.current){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set?.call(input.current,next);input.current.dispatchEvent(new Event('input',{bubbles:true}));}
  close();
 };
 const move=(amount:number)=>setMonth(new Date(Date.UTC(year+(view==='years'?amount*12:view==='months'?amount:0),monthIndex+(view==='days'?amount:0),1,12)));
 const months=Array.from({length:12},(_,index)=>new Intl.DateTimeFormat(locale,{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(year,index,1,12))));
 return <div className="ac-date-field" data-workspace-ui>
  <input {...props} type="text" inputMode={type==='datetime-local'?'text':'numeric'} autoComplete="off" ref={input} value={current} placeholder={type==='month'?t('AAAA-LL','YYYY-MM'):type==='datetime-local'?t('AAAA-LL-ZZTHH:MM','YYYY-MM-DDTHH:MM'):t('AAAA-LL-ZZ','YYYY-MM-DD')} pattern={type==='month'?'[0-9]{4}-[0-9]{2}':type==='datetime-local'?'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}':'[0-9]{4}-[0-9]{2}-[0-9]{2}'} onChange={()=>{}} onInput={event=>{setLocal(event.currentTarget.value);onChange?.(event as unknown as ChangeEvent<HTMLInputElement>);}}/>
  <button ref={trigger} className="ac-date-trigger" type="button" disabled={props.disabled||props.readOnly} aria-haspopup="dialog" aria-expanded={open} aria-label={t('Deschide calendarul','Open calendar')} onClick={()=>{setMonth(initial());setView(type==='month'?'months':'days');setOpen(!open);}}><CalendarDays size={20}/></button>
  {open&&createPortal(<div ref={panel} role="dialog" aria-label={t('Alege data','Choose date')} aria-modal="true" className="ac-calendar" style={position} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const nodes=Array.from(panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
   <header><CalendarDays size={19}/><strong>{t('Alege data','Choose date')}</strong><button type="button" onClick={close} aria-label={t('Închide calendarul','Close calendar')}><X size={19}/></button></header>
   <div className="ac-calendar-navigation"><button type="button" onClick={()=>move(-1)} aria-label={t('Perioada anterioară','Previous period')}><ChevronLeft size={18}/></button><button type="button" onClick={()=>setView('months')}>{months[monthIndex]}</button><button type="button" onClick={()=>setView('years')}>{year}</button><button type="button" onClick={()=>move(1)} aria-label={t('Perioada următoare','Next period')}><ChevronRight size={18}/></button></div>
   {view==='years'?<div className="ac-calendar-periods">{Array.from({length:12},(_,i)=>year-5+i).map(y=><button type="button" key={y} aria-pressed={y===year} onClick={()=>{setMonth(new Date(Date.UTC(y,monthIndex,1,12)));setView('months');}}>{y}</button>)}</div>:view==='months'?<div className="ac-calendar-periods">{months.map((name,index)=><button type="button" key={name} aria-pressed={index===monthIndex} onClick={()=>{if(type==='month')select(year+'-'+String(index+1).padStart(2,'0')+'-01');else{setMonth(new Date(Date.UTC(year,index,1,12)));setView('days');}}}>{name}</button>)}</div>:<><div className="ac-calendar-week" aria-hidden="true">{(en?['Mo','Tu','We','Th','Fr','Sa','Su']:['Lu','Ma','Mi','Jo','Vi','Sâ','Du']).map(day=><span key={day}>{day}</span>)}</div><div className="ac-calendar-days">{calendarCells(year,monthIndex).map(day=><button type="button" key={day.iso} className={day.outside?'is-outside':''} disabled={!!props.min&&day.iso<String(props.min).slice(0,10)||!!props.max&&day.iso>String(props.max).slice(0,10)} aria-label={new Intl.DateTimeFormat(locale,{dateStyle:'full',timeZone:'UTC'}).format(new Date(day.iso+'T12:00:00Z'))} aria-pressed={current.slice(0,10)===day.iso} onClick={()=>select(day.iso)}>{day.day}</button>)}</div></>}
   <footer><small>{t('Format: AAAA-LL-ZZ','Format: YYYY-MM-DD')}</small><button type="button" onClick={()=>{const now=new Date();const iso=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(now);if((!props.min||iso>=String(props.min).slice(0,10))&&(!props.max||iso<=String(props.max).slice(0,10)))select(iso);else setMonth(new Date(Date.UTC(now.getFullYear(),now.getMonth(),1,12)));}}>{t('Astăzi','Today')}</button></footer>
  </div>,document.body)}
 </div>;
}
