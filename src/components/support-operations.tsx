'use client';
import {FilterSelect} from '@/components/filter-select';


import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, CarFront, CheckCheck, Clock3, Headset, Inbox, LockKeyhole, Mail, UserRound, X } from 'lucide-react';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';

export async function supportRequest(path: string, init?: RequestInit) {
  const response = await fetch('/api/v1/support/' + path, { cache: 'no-store', ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(result.error || 'Operațiunea nu a reușit.');
  return result;
}
const json = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
type Context = {
  customer: { name: string; email: string; createdAt: string; verified: boolean };
  premium: boolean; suspended: boolean; vehicleCount: number; lastActivityAt: string | null;
  vehicles: {id:string;brand:string;model:string;plate:string;year:number;odometer:number}[];
  threads: { id: string; status: string; createdAt: string }[];
  notes: { id: string; body: string; author: string | null; createdAt: string }[];
  events: { id: string; action: string; author: string | null; createdAt: string }[];
  operations: { priority: string; workflow: string; rating: number | null } | null;
};
type Stats = { fresh:number; active:number; resolved:number; unread:number; responseSeconds:number|null; resolutionSeconds:number|null; ratings:number; satisfaction:number|null; activity:{name:string;count:number}[]; trend:{day:string;count:number}[] };
const auditLabels: Record<string, [string,string]> = {
  'support.assigned':['Atribuire','Assignment'], 'support.complete':['Finalizare','Completed'], 'support.trash':['Mutare în coș','Moved to trash'],
  'support.restore':['Restaurare','Restored'], 'support.reopen':['Redeschidere','Reopened'], 'support.workflow':['Actualizare flux','Workflow updated'],
  'support.internal_note':['Notă internă','Internal note'], 'support.sent':['Mesaj trimis','Message sent'],
};
export function SupportStatistics({ preview, onClose }: { preview:boolean; onClose:()=>void }) {
  const en=useApplicationLanguage()==='en',locale=useApplicationLocale(),t=(ro:string,english:string)=>en?english:ro;
  const [data,setData]=useState<Stats|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{if(preview)return;const controller=new AbortController();setError('');void supportRequest('statistics',{signal:controller.signal}).then(setData).catch(error=>{if(!controller.signal.aborted)setError(en?'Could not load statistics.':error.message);});return()=>controller.abort();},[preview,revision,en]);
  const duration=(seconds:number|null)=>seconds==null?'—':seconds<60?seconds+' s':seconds<3600?Math.round(seconds/60)+' min':(seconds/3600).toLocaleString(locale,{maximumFractionDigits:1})+' h';
  const max=Math.max(1,...(data?.trend.map(row=>row.count)??[]));
  const teamMax=Math.max(1,...(data?.activity.map(row=>row.count)??[]));
  return <section className="support-statistics-page" aria-label={t('Statistici suport','Support statistics')}>
    <header className="support-stats-header"><button type="button" onClick={onClose}><ArrowLeft size={17}/>{t('Înapoi la conversații','Back to inbox')}</button><div><small>AUTOCARE · SUPPORT</small><h2>{t('Activitatea centrului de suport','Support center activity')}</h2><p>{t('Solicitări, timpi de răspuns și activitatea echipei, din datele reale.','Requests, response times and team activity from real records.')}</p></div></header>
    {error?<div role="alert" className="support-error">{error}<button onClick={()=>setRevision(value=>value+1)}>{t('Reîncearcă','Retry')}</button></div>:!data?<p role="status">{preview?t('Statisticile reale apar în contul echipei.','Real statistics are available in the team account.'):t('Se calculează statisticile…','Loading statistics…')}</p>:<>
      <dl className="support-kpis">{[
        {label:t('Solicitări noi','New requests'),value:data.fresh,icon:Inbox,hint:t('Active, fără responsabil','Open and unassigned')},
        {label:t('Solicitări active','Active requests'),value:data.active,icon:Headset,hint:t('Include solicitările noi','Includes new requests')},
        {label:t('Finalizate','Completed'),value:data.resolved,icon:CheckCheck,hint:t('Status curent: finalizată','Currently completed')},
        {label:t('Primul răspuns mediu','Average first reply'),value:duration(data.responseSeconds),icon:Clock3,hint:t('Prima intervenție a echipei','First team response')},
      ].map(({label,value,icon:Icon,hint})=><div key={label}><span><Icon size={20}/></span><dt>{label}</dt><dd>{value}</dd><small>{hint}</small></div>)}</dl>
      <div className="support-stats-grid"><section className="support-trend"><header><h3><BarChart3 size={19}/>{t('Evoluția solicitărilor','Request trend')}</h3><span>{t('14 zile · UTC','14 days · UTC')}</span></header><p>{data.trend.reduce((sum,row)=>sum+row.count,0).toLocaleString(locale)} {t('solicitări create','requests created')}</p><div className="support-trend-bars" role="list" aria-label={t('Solicitări pe zi','Daily requests')}>{data.trend.map((row,index)=><div key={row.day} role="listitem" title={row.day+' · '+row.count} aria-label={row.day+': '+row.count}><div><i style={{height:(row.count/max*100)+'%'}}/><b>{row.count}</b></div><small>{index%3===0||index===data.trend.length-1?new Date(row.day+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short'}):''}</small></div>)}</div></section>
      <section className="support-team-performance"><header><h3>{t('Activitatea echipei','Team activity')}</h3><span>{t('Ultimele 7 zile','Last 7 days')}</span></header><p>{t('Volumul mesajelor trimise, fără clasamente de calitate presupuse.','Sent message volume, without assumed quality rankings.')}</p>{data.activity.length?<ul>{data.activity.map((operator,index)=><li key={index}><div><span className="support-avatar">{operator.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span><strong data-user-content>{operator.name}</strong><b>{operator.count}</b></div><progress max={teamMax} value={operator.count} aria-label={operator.name}/></li>)}</ul>:<p>{t('Nu există răspunsuri în acest interval.','No replies in this period.')}</p>}</section></div>
      <div className="support-stat-details"><div><span>{t('Rezolvare medie','Average resolution')}</span><strong>{duration(data.resolutionSeconds)}</strong></div><div><span>{t('Necitite pentru tine','Unread for you')}</span><strong>{data.unread}</strong></div><div><span>{t('Satisfacție','Satisfaction')}</span><strong>{data.satisfaction==null?'—':data.satisfaction+'/5'}</strong><small>{data.ratings} {t('evaluări','ratings')}</small></div></div>
    </>}
  </section>;
}
export function SupportCustomerPanel({ id, editable, assignedName, transfer, onChange, onClose, openHistory, locale }: {
  id:string;editable:boolean;assignedName:string;transfer?:{value:string;team:{id:string;name:string}[];onAssign:(id:string)=>Promise<void>};
  onChange:()=>Promise<void>;onClose:()=>void;openHistory:(id:string,status:string)=>void;locale:string;
}) {
  const en=useApplicationLanguage()==='en',t=(ro:string,english:string)=>en?english:ro;
  const [data,setData]=useState<Context|null>(null),[note,setNote]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{const controller=new AbortController();void supportRequest('chat/'+id+'/context',{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(error=>{if(!controller.signal.aborted)setError(en?'Could not load the customer profile.':error.message);});return()=>controller.abort();},[id,revision,en]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
  async function update(payload:unknown){if(pending)return false;setPending(true);setError('');try{await supportRequest('chat/'+id+'/operations',json(payload));setRevision(value=>value+1);await onChange();return true;}catch(error){setError(en?'Could not save the change.':(error as Error).message);return false;}finally{setPending(false);}}
  const state=(status:string)=>status==='open'?t('Activă','Active'):status==='completed'?t('Finalizată','Completed'):t('În coș','In trash');
  return <aside className="support-customer-panel" id="support-customer-panel" aria-label={t('Profil client','Customer profile')}>
    <header><span><UserRound size={18}/>{t('Profil client','Customer profile')}</span><button type="button" onClick={onClose} aria-label={t('Închide profilul','Close profile')}><X size={18}/></button></header>
    {error&&<p role="alert" className="support-error">{error}</p>}
    {!data?!error&&<p role="status">{t('Se încarcă profilul…','Loading profile…')}</p>:<>
      <div className="support-customer-identity"><span className="support-avatar">{data.customer.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span><h3 data-user-content>{data.customer.name}</h3><a href={'mailto:'+data.customer.email} data-user-content><Mail size={13}/>{data.customer.email}</a><span className="support-profile-plan">{data.premium?'Premium':t('Gratuit','Free')}</span></div>
      <dl className="support-profile-facts"><div><dt>{t('Înregistrare','Registered')}</dt><dd>{new Date(data.customer.createdAt).toLocaleDateString(locale)}</dd></div><div><dt>{t('Activitate de sesiune','Session activity')}</dt><dd>{data.lastActivityAt?new Date(data.lastActivityAt).toLocaleString(locale):t('Nedisponibilă','Unavailable')}</dd></div><div><dt>{t('Status cont','Account status')}</dt><dd>{data.suspended?t('Suspendat','Suspended'):data.customer.verified?t('Verificat','Verified'):t('Email neconfirmat','Email unverified')}</dd></div><div><dt>{t('Responsabil','Assigned to')}</dt><dd>{assignedName}</dd></div></dl>
      <section className="support-profile-vehicles"><h4><CarFront size={16}/>{t('Vehicule asociate','Associated vehicles')} <span>{data.vehicleCount}</span></h4>{data.vehicles.length?data.vehicles.map(vehicle=><article key={vehicle.id}><CarFront size={22}/><div><strong data-user-content>{vehicle.brand} {vehicle.model}</strong><span data-user-content>{vehicle.plate}</span><small>{vehicle.year} · {vehicle.odometer.toLocaleString(locale)} km</small></div></article>):<p>{t('Nu există vehicule active.','No active vehicles.')}</p>}</section>
      {transfer&&<label>{t('Transfer către','Transfer to')}<FilterSelect value={transfer.value} disabled={pending} onChange={event=>void transfer.onAssign(event.target.value)}><option value="">{t('Fără responsabil','Unassigned')}</option>{transfer.team.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</FilterSelect></label>}
      <div className="support-operations-controls"><label>{t('Prioritate','Priority')}<FilterSelect value={data.operations?.priority??'normal'} disabled={!editable||pending} onChange={event=>void update({priority:event.target.value})}><option value="normal">{t('Normală','Normal')}</option><option value="high">{t('Ridicată','High')}</option><option value="urgent">{t('Urgentă','Urgent')}</option></FilterSelect></label><label>{t('Flux de lucru','Workflow')}<FilterSelect value={data.operations?.workflow??'working'} disabled={!editable||pending} onChange={event=>void update({workflow:event.target.value})}><option value="working">{t('În lucru','In progress')}</option><option value="waiting">{t('În așteptare','Waiting')}</option></FilterSelect></label></div>
      <details open className="support-profile-notes"><summary><LockKeyhole size={14}/>{t('Note interne','Internal notes')} · {data.notes.length}</summary><small>{t('Vizibile doar echipei. Nu se trimit clientului.','Team only. Never sent to the customer.')}</small>{editable&&<form onSubmit={async event=>{event.preventDefault();if(await update({note}))setNote('');}}><textarea aria-label={t('Notă internă','Internal note')} placeholder={t('Adaugă context pentru echipă…','Add context for the team…')} value={note} onChange={event=>setNote(event.target.value)} maxLength={2000} rows={3} required/><button disabled={pending||!note.trim()}>{t('Salvează nota','Save note')}</button></form>}{data.notes.map(item=><article className="support-internal-note" key={item.id}><strong>{item.author??t('Fost membru','Former team member')}</strong><p data-user-content>{item.body}</p><time>{new Date(item.createdAt).toLocaleString(locale)}</time></article>)}</details>
      <details><summary>{t('Istoric solicitări','Request history')} · {data.threads.length}</summary><ul>{data.threads.map(thread=><li key={thread.id}><button type="button" disabled={thread.id===id} onClick={()=>openHistory(thread.id,thread.status)}>{new Date(thread.createdAt).toLocaleDateString(locale)} · {state(thread.status)}</button></li>)}</ul></details>
      <details><summary>{t('Istoric acțiuni echipă','Team action history')}</summary><ul>{data.events.map(event=><li key={event.id}>{auditLabels[event.action]?.[en?1:0]??t('Acțiune echipă','Team action')} · {event.author??t('Echipă','Team')} <time>{new Date(event.createdAt).toLocaleString(locale)}</time></li>)}</ul></details>
      {data.operations?.rating!=null&&<p className="support-profile-rating">{t('Evaluarea clientului','Customer rating')}: <strong>{data.operations.rating}/5</strong></p>}
    </>}
  </aside>;
}
