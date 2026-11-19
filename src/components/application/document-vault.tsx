'use client';
import {ActionMenu} from '../action-menu';
import {FilterSelect} from '../filter-select';
import {DocumentActions} from '../document-actions';
import {PremiumAttachment} from '../premium-attachment';
import {createPortal} from 'react-dom';
import { useState,useEffect,useRef } from 'react';
import { CarFront, CheckCheck, Clock3, Download, Eye, FileText, Files, Plus, Search, ShieldCheck, Upload } from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { documentCounts, filterRecords } from '@/lib/record-filters';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
type Data=Awaited<ReturnType<typeof dashboard>>;
type Row=Data['records'][number];
export function DocumentVault({data,vehicleId,onVehicle,onEdit,onCreate,onArchive,onDelete,onRestore,onHistory,onUpload,onDeleteFile,onRenewals,preview,busy}:{
 onDelete?:(row:Row)=>void;onRenewals?:()=>void;data:Data;vehicleId:string;onVehicle:(id:string)=>void;onEdit:(row:Row)=>void;onCreate:()=>void;onArchive:(row:Row)=>void;onRestore:(row:Row)=>void;onHistory:(row:Row)=>void;onUpload:(row:Row,file:File)=>Promise<void>;onDeleteFile:(file:Data['attachments'][number])=>void;preview:boolean;busy:boolean;
}){
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale(),t=(ro:string,english:string)=>en?english:ro;
 const [uploadRow,setUploadRow]=useState<Row|null>(null),[uploadFile,setUploadFile]=useState<File|null>(null),[uploadError,setUploadError]=useState(''),[uploading,setUploading]=useState(false);
 const uploadPanel=useRef<HTMLElement>(null);
 useEffect(()=>{if(!uploadRow)return;const old=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';uploadPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!uploading){e.preventDefault();setUploadRow(null);}if(e.key==='Tab'){const nodes=Array.from(uploadPanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')||[]),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);old?.focus();};},[uploadRow,uploading]);
 const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[state,setState]=useState(''),[archived,setArchived]=useState(false);
 const scoped=data.records.filter(row=>row.kind==='document'&&(!vehicleId||row.vehicleId===vehicleId));
 const stats=documentCounts(scoped,new Date(),data.profile.timezone);
 const categories=[...new Set(['ITP','RCA','CASCO','Rovinietă',...scoped.map(row=>row.category)])];
 const rows=filterRecords(scoped,{q:query,category,status:state,archived:archived?'all':'active'},new Date(),data.profile.timezone).sort((a,b)=>(a.status.days??Infinity)-(b.status.days??Infinity));
 const exportUrl=(format:string)=>'/api/v1/export?'+new URLSearchParams({format,kind:'document',...(vehicleId?{vehicleId}:{}),...(category?{category}:{}),...(state?{status:state}:{}),...(query?{q:query}:{}),archived:archived?'all':'active'});
 const day=(date:string|null)=>date?new Date(date+'T12:00:00Z').toLocaleDateString(locale,{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}):t('Necompletat','Not provided');
 return <div className="rg-document-screen" data-workspace-ui>
<div className="rg-vault-category-tabs" role="group" aria-label={t('Categorie document','Document category')}><button type="button" aria-pressed={!category} onClick={()=>setCategory('')}>{t('Toate','All')}</button>{categories.map(value=><button type="button" key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</button>)}</div>
<details className="rg-vault-tools"><summary><Search size={17}/>{t("Căutare și filtre","Search & filters")}</summary>  <div className="rg-vault-toolbar"><label className="rg-vault-car"><CarFront size={26}/><FilterSelect value={vehicleId} aria-label={t('Dosar vehicul','Vehicle folder')} onChange={e=>onVehicle(e.target.value)}><option value="">{t('Toate vehiculele','All vehicles')}</option>{data.vehicles.map(car=><option key={car.id} value={car.id}>{car.brand} {car.model} · {car.plate}</option>)}</FilterSelect></label><button className="rg-m-round" onClick={onCreate} disabled={!data.vehicles.some(car=>!car.archived)} aria-label={t('Adaugă document','Add document')}><Plus size={21}/></button></div>
  <details className="rg-vault-options"><summary>{t('Statistici și reînnoiri','Statistics & renewals')}</summary>  {onRenewals&&<button type="button" onClick={onRenewals}><ShieldCheck size={18}/>{t('RCA & Rovinietă','RCA & Road vignette')}</button>}
  <div className="rg-vault-overview">{[
   {Icon:Files,label:t('Total','Total'),value:stats.total,key:''},
   {Icon:CheckCheck,label:t('Valabile','Valid'),value:stats.valid,key:'valid'},
   {Icon:Clock3,label:t('Expiră curând','Expiring soon'),value:stats.soon,key:'soon'},
  ].map(({Icon,label,value,key})=><button key={label} aria-pressed={state===key} onClick={()=>setState(state===key?'':key)}><span><Icon size={22}/></span><small>{label}</small><strong>{value}</strong></button>)}</div>
  {(stats.expired>0||stats.incomplete>0)&&<div className="rg-vault-attention">{stats.expired>0&&<button onClick={()=>setState(state==='expired'?'':'expired')}>{stats.expired} {t('expirate','expired')}</button>}{stats.incomplete>0&&<span>{stats.incomplete} {t('fără termen completat','without expiry date')}</span>}</div>}
</details>
  <div className="rg-vault-filters"><label className="rg-m-search"><Search size={17}/><input type="search" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Caută documente…','Search documents…')} aria-label={t('Caută documente','Search documents')}/></label><FilterSelect value={state} onChange={e=>setState(e.target.value)} aria-label={t('Starea documentului','Document status')}>{[['',t('Toate stările','All statuses')],['valid',t('Valabile','Valid')],['soon',t('Expiră curând','Expiring soon')],['expired',t('Expirate','Expired')],['incomplete',t('Fără termen','No expiry date')],['archived',t('Arhivate','Archived')]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</FilterSelect><label className="rg-vault-archive-filter"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>{t('Include arhivate','Include archived')}</label></div>
  {data.premium&&<div className="rg-vault-exports"><span>{t('Exportă dosarul','Export folder')}</span><a href={exportUrl('pdf')}><Download size={15}/> PDF</a><a href={exportUrl('csv')}><Download size={15}/> CSV</a></div>}
</details>
  <div className="rg-vault-cards">{rows.map(row=>{
   const car=data.vehicles.find(vehicle=>vehicle.id===row.vehicleId),files=data.attachments.filter(file=>file.recordId===row.id);
   const Icon=row.category==='RCA'||row.category==='CASCO'?ShieldCheck:row.category==='ITP'?CarFront:FileText;
   const status=row.cancelled?t('Arhivat','Archived'):row.status.state==='valid'?t('Valabil','Valid'):row.status.state==='soon'?t('Expiră curând','Expiring soon'):row.status.state==='expired'?t('Expirat','Expired'):t('Termen necunoscut','Expiry unknown');
   return <article key={row.id} className="rg-vault-document" data-state={row.cancelled?'archived':row.status.state}>
    <header><span className="rg-vault-type"><Icon size={26}/></span><div><h2 data-user-content>{row.category}</h2><span className="rg-vault-status">{status}</span></div></header>
    <strong className="rg-vault-vehicle-name" data-user-content>{car?car.brand+' '+car.model+' · '+car.plate:'—'}</strong>
    {row.title!==row.category&&<p className="rg-vault-document-title" data-user-content>{row.title}</p>}{row.provider&&<p data-user-content>{row.provider}</p>}{row.notes&&<p data-user-content>{row.notes}</p>}
    <dl><div><dt>{t('Emis','Issued')}</dt><dd>{day(row.date)}</dd></div><div><dt>{t('Expiră','Expires')}</dt><dd>{day(row.expiresAt)}</dd></div></dl>
    <p className="rg-vault-days"><Clock3 size={15}/>{row.status.days==null?t('Adaugă data de expirare','Add an expiry date'):row.status.days<0?Math.abs(row.status.days)+' '+t('zile de la expirare','days since expiry'):row.status.days+' '+t('zile rămase','days remaining')}</p>
    <footer>{files[0]?<DocumentActions file={files[0]}/>:<button className="rg-vault-preview" onClick={()=>onEdit(row)}><Eye size={16}/>{t('Vezi detalii','View details')}</button>}
     <ActionMenu label={t('Acțiuni pentru ','Actions for ')+row.category}><button onClick={()=>onEdit(row)}>{t('Editează','Edit')}</button><button disabled={preview||busy} onClick={()=>{setUploadRow(row);setUploadFile(null);setUploadError('');}}><Upload size={15}/>{t('Atașează document','Attach document')}</button><button onClick={()=>onHistory(row)}>{t('Istoric modificări','Change history')}</button><button disabled={preview||busy} onClick={()=>row.cancelled?onRestore(row):onArchive(row)}>{row.cancelled?t('Restaurează','Restore'):t('Arhivează','Archive')}</button>{files.map(file=><span className="ac-action-file" key={file.id}><strong data-user-content>{file.name}</strong><DocumentActions file={file}/><button disabled={preview||busy} onClick={()=>onDeleteFile(file)}>{t('Șterge atașamentul','Delete attachment')}</button></span>)}{onDelete&&<button className="ac-action-danger" disabled={busy} onClick={()=>onDelete(row)}>{t('Șterge definitiv','Delete permanently')}</button>}</ActionMenu>
    </footer>
   </article>;
  })}</div>
  <button className="rg-vault-upload" onClick={onCreate} disabled={!data.vehicles.some(v=>!v.archived)}><Plus size={18}/>{t("Încarcă document","Upload document")}</button>
  {!rows.length&&<section className="rg-m-empty"><Files size={42}/><h2>{t('Dosarul este pregătit','Your folder is ready')}</h2><p>{t('Adaugă un document sau schimbă filtrele.','Add a document or change your filters.')}</p><button className="rg-m-primary" onClick={onCreate}>{t('Adaugă document','Add document')}</button></section>}
 {uploadRow&&createPortal(<div className="ac-document-overlay"><section ref={uploadPanel} role="dialog" aria-modal="true" aria-label={t('Atașează document','Attach document')} className="ac-upload-existing"><header><div><h2>{t('Atașează document','Attach document')}</h2><p data-user-content>{uploadRow.category} · {data.vehicles.find(v=>v.id===uploadRow.vehicleId)?.plate}</p></div><button type="button" disabled={uploading} onClick={()=>setUploadRow(null)}>{t('Închide','Close')}</button></header><PremiumAttachment file={uploadFile} onChange={setUploadFile} disabled={uploading}/>{uploadError&&<p role="alert" className="error">{uploadError}</p>}<div className="ac-attachment-dialog-actions"><button type="button" disabled={uploading} onClick={()=>setUploadRow(null)}>{t('Renunță','Cancel')}</button><button className="primary" type="button" disabled={!uploadFile||uploading||preview} onClick={async()=>{if(!uploadFile)return;setUploading(true);setUploadError('');try{await onUpload(uploadRow,uploadFile);setUploadRow(null);}catch{setUploadError(t('Documentul nu a fost atașat. Verifică fișierul și limita contului, apoi reîncearcă.','The document was not attached. Check the file and account limit, then retry.'));}finally{setUploading(false);}}}>{uploading?t('Se încarcă…','Uploading…'):t('Salvează atașamentul','Save attachment')}</button></div></section></div>,document.body)}
 </div>;
}
