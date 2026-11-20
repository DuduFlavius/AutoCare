'use client';
import {useRef,useState} from 'react';
import {FilterSelect} from './filter-select';
import {PremiumDateInput} from './premium-date-input';
import {requestConfirmation} from './premium-dialogs';
import {ApplicationLanguageProvider} from './application-locale';
import {LoaderCircle} from 'lucide-react';
export default function ControlsReview(){
 const [language,setLanguage]=useState<'ro'|'en'>('ro'),[filter,setFilter]=useState('all'),[date,setDate]=useState('2026-11-20'),[count,setCount]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const lock=useRef(false),en=language==='en';
 async function run(fail=false){
  if(lock.current)return;
  lock.current=true;
  try{
   await requestConfirmation(en?'Delete this demonstration document? No real account data is changed.':'Ștergi acest document demonstrativ? Datele reale din conturi nu sunt modificate.',async()=>{
    setBusy(true);setNotice('');setError('');
    await new Promise(resolve=>setTimeout(resolve,500));
    if(fail)throw Error(en?'Simulated server error. Nothing was changed. Try again.':'Eroare de server simulată. Nimic nu a fost modificat. Reîncearcă.');
    setCount(value=>value+1);setNotice(en?'Demonstration action completed once.':'Acțiunea demonstrativă a fost executată o singură dată.');
   });
  }finally{lock.current=false;setBusy(false);}
 }
 return <ApplicationLanguageProvider language={language}><main data-language={language} style={{maxWidth:840,padding:24,margin:'0 auto',color:'#fff',minHeight:'100dvh',background:'#050E0B'}}><h1>AutoCare · UI review</h1><p>{en?'Isolated preview. Actions use demonstration data only.':'Previzualizare izolată. Acțiunile folosesc exclusiv date demonstrative.'}</p><button onClick={()=>setLanguage(en?'ro':'en')}>RO / EN</button><section style={{display:'grid',gap:18,marginTop:24}}><label>{en?'Category':'Categorie'}<FilterSelect aria-label={en?'Category':'Categorie'} value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">{en?'All documents':'Toate documentele'}</option><option value="RCA">RCA</option><option value="ITP">ITP</option><option value="CASCO">CASCO</option><option value="long">{en?'A very long document name that must remain readable on a narrow phone':'Document cu o denumire foarte lungă care trebuie să rămână lizibil pe un telefon îngust'}</option><option disabled value="disabled">{en?'Unavailable':'Indisponibil'}</option>{Array.from({length:25},(_,index)=><option key={index} value={'other'+index}>{en?'Other document':'Alt document'} {index+1}</option>)}</FilterSelect></label><p role="status">{en?'Selected filter: ':'Filtru selectat: '}{filter}</p><form onSubmit={event=>{event.preventDefault();setNotice((en?'Valid date saved: ':'Dată validă salvată: ')+date);}}><label>{en?'Expiry date':'Data expirării'}<PremiumDateInput required value={date} min="2020-01-01" max="2040-12-31" onChange={event=>setDate(event.target.value)}/></label><button type="submit">{en?'Save date':'Salvează data'}</button></form><div style={{display:'flex',flexWrap:'wrap',gap:12}}><button disabled={busy} onClick={()=>void run()}>{busy?<LoaderCircle size={18}/>:en?'Delete demo document':'Șterge documentul demo'}</button><button disabled={busy} onClick={()=>void run(true)}>{en?'Simulate server error':'Simulează eroare de server'}</button></div><p data-testid="action-count">{en?'Executed actions: ':'Acțiuni executate: '}{count}</p>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</section></main></ApplicationLanguageProvider>;
}
