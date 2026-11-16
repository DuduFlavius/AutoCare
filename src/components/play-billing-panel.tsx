'use client';
import {useApplicationLanguage} from './application-locale';
import {useEffect,useState} from 'react';
import {hasPlayBilling,restorePlayPurchases} from '@/lib/play-billing-client';
export default function PlayBillingPanel({onUpdated}:{onUpdated:()=>Promise<void>}){
 const en=useApplicationLanguage()==='en';
 const [native,setNative]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>setNative(hasPlayBilling()),[]);
 if(!native)return null;
 return <section className="card"><h3>Google Play</h3><p>{en?'Confirm payment in Google Play. Manage your membership from your Google Play account.':'Plata se confirmă în Google Play. Poți gestiona abonamentul din contul Google Play.'}</p><div className="inline"><button disabled={busy} onClick={async()=>{setBusy(true);try{await restorePlayPurchases();await onUpdated();setMessage(en?'Google Play purchases checked.':'Achizițiile Google Play au fost verificate.');}catch{setMessage(en?'Restore failed. Check that you are using the same Google Play account and try again.':'Restaurarea nu a reușit. Verifică același cont Google Play și încearcă din nou.');}finally{setBusy(false);}}}>{busy?(en?'Checking…':'Se verifică…'):(en?'Restore purchases':'Restaurează achizițiile')}</button><a href="https://play.google.com/store/account/subscriptions">{en?'Manage in Google Play':'Gestionează în Google Play'}</a></div>{message&&<p role="status">{message}</p>}</section>;
}
