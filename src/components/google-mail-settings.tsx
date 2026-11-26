'use client';
import { useApplicationLocale } from './application-locale';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowUpRight, CircleCheck, Mail, MailCheck, RefreshCw, Unplug } from 'lucide-react';
import { requestConfirmation } from './premium-dialogs';

export type GmailStatus = {
  configured:boolean; connected:boolean; testedAt?:string|null; reconnectRequired?:boolean;
  from?:string; missing?:string[]; callback?:string; availableHere?:boolean; studioUrl?:string;
};

export async function googleMailRequest(action:string, method='GET') {
  const response=await fetch('/api/v1/mail/google/'+action,{method,cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Operațiunea Gmail nu a reușit.');
  return result;
}

export default function GoogleMailSettings({compact=false,onStatus}:{
  compact?:boolean; onStatus?:(value:GmailStatus|null)=>void;
}={}) {
  const en=useApplicationLocale()==='en-GB';
  const t=(ro:string,eng:string)=>en?eng:ro;
  const [status,setStatus]=useState<GmailStatus|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const running=useRef(false);
  const update=useCallback((value:GmailStatus|null)=>{setStatus(value);onStatus?.(value);},[onStatus]);
  useEffect(()=>{
    let active=true;
    const url=new URL(window.location.href);
    const outcome=url.searchParams.get('gmail');
    if(outcome){
      url.searchParams.delete('gmail');
      window.history.replaceState(null,'',url.pathname+url.search+url.hash);
      if(outcome==='connected')setNotice(en?'Gmail connected. Send a test to finish.':'Gmail conectat. Trimite testul pentru a finaliza.');
      if(outcome==='failed')setError(en?'Google authorization did not complete. Try connecting again.':'Autorizarea Google nu s-a încheiat. Reîncearcă conectarea.');
    }
    void googleMailRequest('status').then(value=>{if(active)update(value);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[update,en]);
  async function act(action:'connect'|'test'|'disconnect'|'status'){
    if(running.current)return;
    running.current=true;setBusy(true);setError('');setNotice('');
    try{
      if(action==='disconnect'&&!await requestConfirmation(t('Deconectezi adresa Gmail din AutoCare?','Disconnect the Gmail address from AutoCare?')))return;
      const result=await googleMailRequest(action,action==='status'?'GET':'POST');
      if(action==='connect'){
        const url=new URL(result.url);
        if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth')throw new Error('Adresă Google invalidă.');
        window.location.assign(url.href);
        return;
      }
      if(action==='test')setNotice(t('Gmail a acceptat testul pentru '+result.to+'. Verifică Inbox și Spam.','Gmail accepted the test for '+result.to+'. Check Inbox and Spam.'));
      update(action==='status'?result:await googleMailRequest('status'));
    }catch(e){
      setError((e as Error).message);
      if(action!=='status')await googleMailRequest('status').then(update).catch(()=>{});
    }finally{running.current=false;setBusy(false);}
  }
  const ready=Boolean(status?.connected&&status.testedAt&&!status.reconnectRequired);
  const canTest=Boolean(status?.availableHere&&status.connected&&!status.reconnectRequired);
  const label=!status?t('Se verifică Gmail…','Checking Gmail…'):!status.configured?t('Configurare Gmail necesară','Gmail setup required'):
    status.reconnectRequired?t('Reconectare necesară','Reconnect required'):!status.connected?t('Gmail deconectat','Gmail disconnected'):
    ready?t('Gmail pregătit pentru trimitere','Gmail ready to send'):t('Gmail conectat · test necesar','Gmail connected · test needed');
  return <section className={'google-console-settings studio-gmail '+(compact?'studio-gmail-compact':'card')} aria-busy={busy}>
    <div className="studio-gmail-status"><span aria-hidden="true">{ready?<CircleCheck size={21}/>:<Mail size={21}/>}</span>
      <div><h3>{label}</h3>{status?.from&&<p>{status.from}{status.testedAt?' · '+new Date(status.testedAt).toLocaleString(en?'en-GB':'ro-RO'):''}</p>}</div>
    </div>
    {status?.availableHere===false&&<p>{t('Conectarea și testul Gmail se fac pe domeniul oficial AutoCare.','Connect and test Gmail on the official AutoCare domain.')}</p>}
    {canTest&&!ready&&<p>{t('Testul se trimite exclusiv către adresa Gmail conectată.','The test is sent only to the connected Gmail address.')}</p>}
    <div className="inline">
      {status?.availableHere===false&&status.studioUrl&&<a href={status.studioUrl}>{t('Deschide Mail Studio oficial','Open official Mail Studio')} <ArrowUpRight size={15}/></a>}
      {canTest&&(!ready||!compact)&&<button className="studio-primary primary" type="button" disabled={busy} onClick={()=>void act('test')}><MailCheck size={17}/>{t('Trimite email de test','Send test email')}</button>}
      {status?.availableHere&&status.configured&&(!status.connected||status.reconnectRequired)&&<button className="studio-primary primary" type="button" disabled={busy} onClick={()=>void act('connect')}>{t(status.reconnectRequired?'Reconectează Gmail':'Conectează Gmail',status.reconnectRequired?'Reconnect Gmail':'Connect Gmail')}</button>}
      {!compact&&status?.availableHere&&status.connected&&<button type="button" disabled={busy} onClick={()=>void act('disconnect')}><Unplug size={16}/>{t('Deconectează','Disconnect')}</button>}
      <button type="button" disabled={busy} onClick={()=>void act('status')}><RefreshCw size={16}/>{t('Verifică starea','Refresh status')}</button>
    </div>
    {!compact&&status&&!status.configured&&<details><summary>{t('Detalii de configurare OAuth','OAuth setup details')}</summary>
      <ul>{status.missing?.map(key=><li key={key}><code>{key}</code></li>)}</ul>{status.callback&&<p>Redirect URI · <code>{status.callback}</code></p>}
    </details>}
    {error&&<p className="error" role="alert">{error}</p>}
    {notice&&<p className="notice" role="status">{notice}</p>}
  </section>;
}
