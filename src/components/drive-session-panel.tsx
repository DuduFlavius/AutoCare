'use client';
import type {ReactNode} from 'react';
import {Gauge,Route,Timer,TrendingUp,Activity,Radio} from 'lucide-react';
import {driveDuration} from '@/lib/drive-display';
import type {GPSSignal} from '@/lib/gps-status';
export type DrivePanelState='idle'|'active'|'paused'|'finished'|'saving';
export type DrivePanelData={state:DrivePanelState;speed:number|null;meters:number;seconds:number;average:number|null;maximum:number|null;signal:GPSSignal;controls:ReactNode;messages?:ReactNode};
export function DriveSessionPanel({session,english=false,children}:{session:DrivePanelData;english?:boolean;children?:ReactNode}){
 const t=(ro:string,en:string)=>english?en:ro;
 const signals:Record<GPSSignal,string>={off:t('GPS oprit','GPS off'),requesting:t('Se conectează','Connecting'),searching:t('Caut semnal','Finding signal'),connected:t('Semnal bun','Good signal'),weak:t('Semnal slab','Weak signal'),stale:t('Semnal pierdut','Signal lost'),error:t('GPS indisponibil','GPS unavailable')};
 const speed=(value:number|null)=>value===null?'—':Math.round(value)+' km/h';
 const rows=[{key:'speed',Icon:Gauge,label:t('Viteză','Speed'),value:speed(session.speed)},{key:'distance',Icon:Route,label:t('Distanță parcursă','Recorded distance'),value:(session.meters/1000).toLocaleString(english?'en-GB':'ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2})+' km'},{key:'time',Icon:Timer,label:t('Durată sesiune','Session time'),value:driveDuration(session.seconds)},{key:'average',Icon:TrendingUp,label:t('Viteză medie','Average speed'),value:speed(session.average)},{key:'maximum',Icon:Activity,label:t('Viteză maximă','Maximum speed'),value:speed(session.maximum)},{key:'signal',Icon:Radio,label:t('Stare GPS','GPS status'),value:signals[session.signal]}];
 return <section className="sd-session-panel" data-state={session.state} aria-label={t('Statisticile sesiunii GPS','GPS session statistics')}>
  <div className="sd-session-heading"><span><i/>{session.state==='paused'?t('Sesiune în pauză','Session paused'):session.state==='finished'?t('Sesiune finalizată','Session finished'):session.state==='active'?t('Sesiune activă','Session active'):session.state==='saving'?t('Se salvează sesiunea…','Saving session…'):t('Pregătit de drum','Ready to drive')}</span>{children}</div>
  <dl className="sd-session-metrics">{rows.map(({key,Icon,label,value})=><div key={key} data-metric={key}><dt><Icon size={20}/>{label}</dt><dd>{value}</dd></div>)}</dl>
  <div className="sd-session-actions">{session.controls}</div>
  {session.messages&&<div className="sd-session-notices">{session.messages}</div>}
 </section>;
}
