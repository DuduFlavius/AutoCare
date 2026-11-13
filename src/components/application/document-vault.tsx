'use client';
import { useState } from 'react';
import { CarFront, CheckCheck, Clock3, Download, Eye, FileText, Files, MoreHorizontal, Plus, Search, ShieldCheck, Upload } from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { documentCounts, filterRecords } from '@/lib/record-filters';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
type Data=Awaited<ReturnType<typeof dashboard>>;
type Row=Data['records'][number];
export function DocumentVault({data,vehicleId,onVehicle,onEdit,onCreate,onArchive,onRestore,onHistory,onUpload,onDeleteFile,preview,busy}:{
 data:Data;vehicleId:string;onVehicle:(id:string)=>void;onEdit:(row:Row)=>void;onCreate:()=>void;onArchive:(row:Row)=>void;onRestore:(row:Row)=>void;onHistory:(row:Row)=>void;onUpload:(row:Row,file:File)=>Promise<void>;onDeleteFile:(file:Data['attachments'][number])=>void;preview:boolean;busy:boolean;
}){
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale(),t=(ro:string,english:string)=>en?english:ro;
 const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[state,setState]=useState(''),[archived,setArchived]=useState(false);
 const scoped=data.records.filter(row=>row.kind==='document'&&(!vehicleId||row.vehicleId===vehicleId));
 const stats=documentCounts(scoped,new Date(),data.profile.timezone);
 const categories=[...new Set(scoped.map(row=>row.category))].sort();
 const rows=filterRecords(scoped,{q:query,category,status:state,archived:archived?'all':'active'},new Date(),data.profile.timezone).sort((a,b)=>(a.status.days??Infinity)-(b.status.days??Infinity));
 const exportUrl=(format:string)=>'/api/v1/export?'+new URLSearchParams({format,kind:'document',...(vehicleId?{vehicleId}:{}),...(category?{category}:{}),...(state?{status:state}:{}),...(query?{q:query}:{}),archived:archived?'all':'active'});
 const day=(date:string|null)=>date?new Date(date+'T12:00:00Z').toLocaleDateString(locale,{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}):t('Necompletat','Not provided');
 return <div className="ac-document-screen" data-workspace-ui>
  <div className="ac-vault-toolbar"><label className="ac-vault-car"><CarFront size={26}/><select value={vehicleId} aria-label={t('Dosar vehicul','Vehicle folder')} onChange={e=>onVehicle(e.target.value)}><option value="">{t('Toate vehiculele','All vehicles')}</option>{data.vehicles.map(car=><option key={car.id} value={car.id}>{car.brand} {car.model} · {car.plate}</option>)}</select></label><button className="ac-m-round" onClick={onCreate} disabled={!data.vehicles.some(car=>!car.archived)} aria-label={t('Adaugă document','Add document')}><Plus size={21}/></button></div>
  <div className="ac-vault-overview">{[
   {Icon:Files,label:t('Total','Total'),value:stats.total,key:''},
   {Icon:CheckCheck,label:t('Valabile','Valid'),value:stats.valid,key:'valid'},
   {Icon:Clock3,label:t('Expiră curând','Expiring soon'),value:stats.soon,key:'soon'},
  ].map(({Icon,label,value,key})=><button key={label} aria-pressed={state===key} onClick={()=>setState(state===key?'':key)}><span><Icon size={22}/></span><small>{label}</small><strong>{value}</strong></button>)}</div>
  {(stats.expired>0||stats.incomplete>0)&&<div className="ac-vault-attention">{stats.expired>0&&<button onClick={()=>setState(state==='expired'?'':'expired')}>{stats.expired} {t('expirate','expired')}</button>}{stats.incomplete>0&&<span>{stats.incomplete} {t('fără termen completat','without expiry date')}</span>}</div>}
  <div className="ac-vault-filters"><label className="ac-m-search"><Search size={17}/><input type="search" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Caută documente…','Search documents…')} aria-label={t('Caută documente','Search documents')}/></label><select value={category} onChange={e=>setCategory(e.target.value)} aria-label={t('Categorie document','Document category')}><option value="">{t('Toate categoriile','All categories')}</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select><select value={state} onChange={e=>setState(e.target.value)} aria-label={t('Starea documentului','Document status')}>{[['',t('Toate stările','All statuses')],['valid',t('Valabile','Valid')],['soon',t('Expiră curând','Expiring soon')],['expired',t('Expirate','Expired')],['incomplete',t('Fără termen','No expiry date')],['archived',t('Arhivate','Archived')]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><label className="ac-vault-archive-filter"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>{t('Include arhivate','Include archived')}</label></div>
  {data.premium&&<div className="ac-vault-exports"><span>{t('Exportă dosarul','Export folder')}</span><a href={exportUrl('pdf')}><Download size={15}/> PDF</a><a href={exportUrl('csv')}><Download size={15}/> CSV</a></div>}
  <div className="ac-vault-cards">{rows.map(row=>{
   const car=data.vehicles.find(vehicle=>vehicle.id===row.vehicleId),files=data.attachments.filter(file=>file.recordId===row.id);
   const Icon=row.category==='RCA'||row.category==='CASCO'?ShieldCheck:row.category==='ITP'?CarFront:FileText;
   const status=row.cancelled?t('Arhivat','Archived'):row.status.state==='valid'?t('Valabil','Valid'):row.status.state==='soon'?t('Expiră curând','Expiring soon'):row.status.state==='expired'?t('Expirat','Expired'):t('Termen necunoscut','Expiry unknown');
   return <article key={row.id} className="ac-vault-document" data-state={row.cancelled?'archived':row.status.state}>
    <header><span className="ac-vault-type"><Icon size={26}/></span><div><h2 data-user-content>{row.category}</h2><span className="ac-vault-status">{status}</span></div></header>
    <strong className="ac-vault-vehicle-name" data-user-content>{car?car.brand+' '+car.model+' · '+car.plate:'—'}</strong>
    {row.title!==row.category&&<p className="ac-vault-document-title" data-user-content>{row.title}</p>}{row.provider&&<p data-user-content>{row.provider}</p>}{row.notes&&<p data-user-content>{row.notes}</p>}
    <dl><div><dt>{t('Emis','Issued')}</dt><dd>{day(row.date)}</dd></div><div><dt>{t('Expiră','Expires')}</dt><dd>{day(row.expiresAt)}</dd></div></dl>
    <p className="ac-vault-days"><Clock3 size={15}/>{row.status.days==null?t('Adaugă data de expirare','Add an expiry date'):row.status.days<0?Math.abs(row.status.days)+' '+t('zile de la expirare','days since expiry'):row.status.days+' '+t('zile rămase','days remaining')}</p>
    <footer>{files[0]?<><a className="ac-vault-preview" href={'/api/v1/files/'+files[0].id+'?view=1'} target="_blank" rel="noopener noreferrer"><Eye size={16}/>{t('Previzualizare','Preview')}</a><a className="ac-m-round" href={'/api/v1/files/'+files[0].id} download aria-label={t('Descarcă ','Download ')+files[0].name}><Download size={18}/></a></>:<button className="ac-vault-preview" onClick={()=>onEdit(row)}><Eye size={16}/>{t('Vezi detalii','View details')}</button>}
     <details className="ac-vault-menu"><summary className="ac-m-round" aria-label={t('Acțiuni pentru ','Actions for ')+row.category}><MoreHorizontal size={20}/></summary><div><button onClick={()=>onEdit(row)}>{t('Editează','Edit')}</button><label><Upload size={15}/>{t('Atașează document','Attach document')}<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" disabled={preview||busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await onUpload(row,file);}}/></label><button onClick={()=>onHistory(row)}>{t('Istoric modificări','Change history')}</button><button disabled={preview||busy} onClick={()=>row.cancelled?onRestore(row):onArchive(row)}>{row.cancelled?t('Restaurează','Restore'):t('Arhivează','Archive')}</button>{files.map(file=><span className="ac-vault-extra-file" key={file.id}><a href={'/api/v1/files/'+file.id+'?view=1'} target="_blank" rel="noopener noreferrer">{file.name}</a><a href={'/api/v1/files/'+file.id} download aria-label={t('Descarcă ','Download ')+file.name}><Download size={15}/></a><button disabled={preview||busy} onClick={()=>onDeleteFile(file)}>{t('Șterge atașamentul','Delete attachment')}</button></span>)}</div></details>
    </footer>
   </article>;
  })}</div>
  {!rows.length&&<section className="ac-m-empty"><Files size={42}/><h2>{t('Dosarul este pregătit','Your folder is ready')}</h2><p>{t('Adaugă un document sau schimbă filtrele.','Add a document or change your filters.')}</p><button className="ac-m-primary" onClick={onCreate}>{t('Adaugă document','Add document')}</button></section>}
 </div>;
}
