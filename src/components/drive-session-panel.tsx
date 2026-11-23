'use client';
import {useId,useRef,useState,type ReactNode} from 'react';
import {Gauge,Route,Timer,TrendingUp,Activity,Radio,ChevronUp,LocateFixed,Clock3,X} from 'lucide-react';
import {driveDuration} from '@/lib/drive-display';
import type {GPSSignal} from '@/lib/gps-status';
export type DrivePanelState='idle'|'active'|'paused'|'finished'|'saving'|'unsaved';
export type DrivePanelData={state:DrivePanelState;speed:number|null;meters:number;seconds:number;average:number|null;maximum:number|null;signal:GPSSignal;accuracy?:number|null;startedAt?:number|null;controls:ReactNode;finishControl?:ReactNode;messages?:ReactNode};
export function DriveSessionPanel({session,english=false,children,compact=false}:{session:DrivePanelData;english?:boolean;children?:ReactNode;compact?:boolean}){
 const t=(ro:string,en:string)=>english?en:ro;
 const [expanded,setExpanded]=useState(false);
 const detailsId=useId();
 const touchStart=useRef<number|null>(null);
 const signals:Record<GPSSignal,string>={off:t('GPS oprit','GPS off'),requesting:t('Se conectează','Connecting'),searching:t('Caut semnal','Finding signal'),connected:t('Semnal bun','Good signal'),weak:t('Semnal slab','Weak signal'),stale:t('Semnal pierdut','Signal lost'),error:t('GPS indisponibil','GPS unavailable')};
 const speed=(value:number|null)=>value===null?'—':Math.round(value)+' km/h';
 const rows=[{key:'speed',Icon:Gauge,label:t('Viteză','Speed'),value:speed(session.speed)},{key:'distance',Icon:Route,label:t('Distanță parcursă','Recorded distance'),value:(session.meters/1000).toLocaleString(english?'en-GB':'ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})+' km'},{key:'time',Icon:Timer,label:t('Durată sesiune','Session time'),value:driveDuration(session.seconds)},{key:'average',Icon:TrendingUp,label:t('Viteză medie','Average speed'),value:speed(session.average)},{key:'maximum',Icon:Activity,label:t('Viteză maximă','Maximum speed'),value:speed(session.maximum)},{key:'signal',Icon:Radio,label:t('Stare GPS','GPS status'),value:signals[session.signal]}];
 const metrics=(items:typeof rows)=>items.map(({key,Icon,label,value})=><div key={key} data-metric={key}><dt><Icon size={20} aria-hidden="true"/>{label}</dt><dd>{value}</dd></div>);
 const state=session.state==='paused'?t('Sesiune în pauză','Session paused'):session.state==='finished'?t('Sesiune finalizată','Session finished'):session.state==='active'?t('Sesiune activă','Session active'):session.state==='saving'?t('Se salvează sesiunea…','Saving session…'):session.state==='unsaved'?t('Sesiune în așteptarea salvării','Trip awaiting save'):t('Pregătit de drum','Ready to drive');
 return <section className="sd-session-panel" data-state={session.state} data-compact={compact} aria-label={t('Statisticile sesiunii GPS','GPS session statistics')}>
  <div className="sd-session-heading"><span><i/>{state}</span>{compact?<small className="sd-compact-signal">{signals[session.signal]}</small>:children}
   <button className="sd-details-toggle" type="button" aria-expanded={expanded} aria-controls={detailsId} aria-label={t('Detalii sesiune','Session details')} onClick={()=>setExpanded(value=>!value)}><ChevronUp size={22} aria-hidden="true"/></button>
  </div>
  <div className="sd-summary-body">
   <dl className="sd-session-metrics sd-session-summary">{metrics(rows.filter(row=>compact?['distance','time'].includes(row.key):['speed','distance','time','signal'].includes(row.key)))}</dl>
   <div className={compact?"sd-floating-session-action sd-session-actions":"sd-session-actions"}>{session.controls}{!compact && session.finishControl}</div>
  </div>
  <section id={detailsId} className="sd-session-sheet" hidden={!expanded} aria-label={t('Detalii sesiune','Session details')}>
   <header onPointerDown={event=>{touchStart.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}}
    onPointerCancel={()=>{touchStart.current=null;}}
    onPointerUp={event=>{if(touchStart.current!=null&&event.clientY-touchStart.current>36)setExpanded(false);touchStart.current=null;}}>
    <span className="sd-sheet-grip" aria-hidden="true"/>
    <strong>{t('Detalii sesiune','Session details')}</strong>
    <button type="button" className="sd-sheet-close" aria-label={t('Închide detaliile','Close details')} onPointerDown={event=>event.stopPropagation()} onClick={()=>setExpanded(false)}><X size={20}/></button>
   </header>
   <dl className="sd-session-metrics sd-session-detail">
    {metrics(rows.filter(row=>compact||['average','maximum'].includes(row.key)))}
    <div><dt><LocateFixed size={20} aria-hidden="true"/>{t('Precizie GPS','GPS accuracy')}</dt><dd>{session.accuracy!=null?'± '+Math.round(session.accuracy)+' m':'—'}</dd></div>
    <div><dt><Clock3 size={20} aria-hidden="true"/>{t('Pornire','Started at')}</dt><dd>{session.startedAt?new Date(session.startedAt).toLocaleTimeString(english?'en-GB':'ro-RO'):'—'}</dd></div>
   </dl>
   {compact && <><div className="sd-sheet-route">{children}</div><div className="sd-session-actions">{session.controls}{session.finishControl}</div></>}
  </section>
  {session.messages&&<div className="sd-session-notices">{session.messages}</div>}
 </section>;
}
