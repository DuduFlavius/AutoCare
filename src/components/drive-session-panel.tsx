'use client';
import {useId,useRef,useState,type ReactNode} from 'react';
import {Gauge,Route,Timer,TrendingUp,Activity,Radio,ChevronUp,LocateFixed,Clock3,X} from 'lucide-react';
import {driveDuration} from '@/lib/drive-display';
import type {GPSSignal} from '@/lib/gps-status';
export type DrivePanelState='idle'|'active'|'paused'|'finished'|'saving'|'unsaved';
export type DrivePanelData={state:DrivePanelState;speed:number|null;meters:number;seconds:number;average:number|null;maximum:number|null;signal:GPSSignal;accuracy?:number|null;startedAt?:number|null;vehicleLabel?:string;controls:ReactNode;finishControl?:ReactNode;options?:ReactNode;pendingCount?:number;messages?:ReactNode};
export function DriveSessionPanel({session,english=false,children,compact=false,vehicleSelector,suspendDetails=false}:{session:DrivePanelData;english?:boolean;children?:ReactNode;compact?:boolean;vehicleSelector?:ReactNode;suspendDetails?:boolean}){
 const t=(ro:string,en:string)=>english?en:ro;
 const [expanded,setExpanded]=useState(false);
 const detailsId=useId();
 const touchStart=useRef<number|null>(null);
 const signals:Record<GPSSignal,string>={off:t('GPS oprit','GPS off'),requesting:t('Se conectează','Connecting'),searching:t('Caut semnal','Finding signal'),connected:t('Semnal bun','Good signal'),weak:t('Semnal GPS slab','Weak GPS signal'),stale:t('Semnal pierdut','Signal lost'),error:t('GPS indisponibil','GPS unavailable')};
 const speed=(value:number|null)=>value===null?'—':Math.round(value)+' km/h';
 const rows=[{key:'speed',Icon:Gauge,label:t('Viteză','Speed'),value:speed(session.speed)},{key:'distance',Icon:Route,label:t('Distanță parcursă','Recorded distance'),value:(session.meters/1000).toLocaleString(english?'en-GB':'ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})+' km'},{key:'time',Icon:Timer,label:t('Durată sesiune','Session time'),value:driveDuration(session.seconds)},{key:'average',Icon:TrendingUp,label:t('Viteză medie','Average speed'),value:speed(session.average)},{key:'maximum',Icon:Activity,label:t('Viteză maximă','Maximum speed'),value:speed(session.maximum)},{key:'signal',Icon:Radio,label:t('Stare GPS','GPS status'),value:signals[session.signal]}];
 const metrics=(items:typeof rows)=>items.map(({key,Icon,label,value})=><div key={key} data-metric={key}><dt><Icon size={20} aria-hidden="true"/>{label}</dt><dd>{value}</dd></div>);
 const dragged=useRef(false);
 const ready=session.state==='idle';
 const review=session.state==='unsaved'||session.state==='saving'||session.state==='finished';
 const state=session.state==='paused'?t('Sesiune în pauză','Session paused'):session.state==='finished'?t('Sesiune finalizată','Session finished'):session.state==='active'?t('Înregistrare activă','Recording active'):session.state==='saving'?t('Se salvează sesiunea…','Saving session…'):session.state==='unsaved'?t('Sesiune nesalvată','Unsaved session'):t('Pregătit de drum','Ready to drive');
 return <section className="sd-session-panel" data-state={session.state} data-compact={compact} aria-label={t('Statisticile sesiunii GPS','GPS session statistics')}>
  <div className="sd-session-heading"><span><i/>{state}</span>{compact?<small className="sd-compact-signal">{signals[session.signal]}</small>:children}
   {!!session.pendingCount&&<button type="button" className="sd-pending-count" aria-expanded={expanded} aria-controls={detailsId} onClick={()=>setExpanded(value=>!value)}>{t('Nesalvate','Unsaved')} · {session.pendingCount}</button>}
   <button className="sd-details-toggle" type="button" aria-expanded={expanded} aria-controls={detailsId} aria-label={t('Detalii sesiune','Session details')} onClick={()=>setExpanded(value=>!value)}><ChevronUp size={22} aria-hidden="true"/></button>
  </div>
  {compact&&<button type="button" className="sd-dock-grip" aria-label={t('Extinde statisticile','Expand statistics')} aria-expanded={expanded} aria-controls={detailsId}
   onPointerDown={event=>{dragged.current=false;touchStart.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}}
   onPointerCancel={()=>{touchStart.current=null;}}
   onPointerUp={event=>{if(touchStart.current!=null&&touchStart.current-event.clientY>36){dragged.current=true;setExpanded(true);}touchStart.current=null;}}
   onClick={event=>{if(!event.detail||!dragged.current)setExpanded(value=>!value);}}><span className="sd-sheet-grip" aria-hidden="true"/></button>}
  {compact&&children&&<div className="sd-route-glance">{children}</div>}
  {!compact&&ready&&vehicleSelector&&<div className="sd-primary-vehicle">{vehicleSelector}</div>}
  {review&&session.startedAt&&<div className="sd-final-context"><strong>{session.vehicleLabel}</strong><time dateTime={new Date(session.startedAt).toISOString()}>{new Intl.DateTimeFormat(english?'en-GB':'ro-RO',{dateStyle:'medium',timeStyle:'short'}).format(session.startedAt)}</time></div>}
  <div className="sd-summary-body">
   <dl className="sd-session-metrics sd-session-summary">{metrics(rows.filter(row=>compact?(review?['distance','time','average']:['distance','time']).includes(row.key):['speed','distance','time','signal'].includes(row.key)))}</dl>
   <div className="sd-session-actions">{session.controls}{session.finishControl}</div>
  </div>
  <section id={detailsId} className="sd-session-sheet" hidden={!expanded||suspendDetails} aria-label={t('Detalii sesiune','Session details')}>
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
   {compact&&ready&&vehicleSelector&&<div className="sd-primary-vehicle">{vehicleSelector}</div>}
   {session.options}
  </section>
  {session.messages&&<div className="sd-session-notices">{session.messages}</div>}
 </section>;
}
