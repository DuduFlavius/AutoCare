'use client';
import {useState} from 'react';
import {ShieldCheck,RefreshCw} from 'lucide-react';
import {useApplicationLanguage} from './application-locale';
type Row={currency:string;interval:string;ready:boolean;priceId?:string;amount?:number;livemode?:boolean;error?:string};
export default function BillingCatalogAudit() {
 const en=useApplicationLanguage()==='en';const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function inspect(){setBusy(true);setError('');try{const r=await fetch('/api/v1/founder/billing-catalog',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.rows);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="ac-billing-audit"><h3><ShieldCheck size={18}/>{en?'Stripe catalog · RON / EUR':'Catalog Stripe · RON / EUR'}</h3><p>{en?'Read-only verification of six prices. No subscriptions or prices are changed.':'Verificare fără modificări a celor șase prețuri. Nu schimbă abonamentele sau prețurile Stripe.'}</p><button type="button" disabled={busy} onClick={()=>void inspect()}><RefreshCw size={16}/>{busy?(en?'Checking…':'Se verifică…'):(en?'Verify Stripe prices':'Verifică prețurile Stripe')}</button>{error&&<p role="alert">{error}</p>}<div className="ac-billing-audit-grid">{rows.map(row=><article key={row.currency+row.interval}><strong>{row.currency.toUpperCase()} · {row.interval}</strong><p>{row.ready?new Intl.NumberFormat(en?'en-GB':'ro-RO',{style:'currency',currency:row.currency}).format(row.amount!/100):en?'Not configured':'Neconfigurat'}</p>{row.ready?<><code>{row.priceId}</code><small>{row.livemode?'LIVE':'TEST'}</small></>:<p role="status">{row.error}</p>}</article>)}</div></section>;
}
