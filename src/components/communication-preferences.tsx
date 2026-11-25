'use client';
import { useEffect, useState } from 'react';
import { useApplicationLocale } from './application-locale';
import type { EmailCategories } from '@/lib/mail-preference-categories';

const fields: Array<[keyof EmailCategories,string,string]> = [
  ['releases','Actualizări AutoCare','AutoCare releases'],
  ['news','Noutăți și funcționalități','Product news and features'],
  ['maintenance','Notificări de întreținere','Maintenance reminders'],
  ['documents','Documente și expirări','Documents and expiry dates'],
  ['monthly','Rapoarte lunare','Monthly reports'],
  ['tips','Sfaturi auto','Vehicle tips'],
  ['offers','Oferte și comunicări promoționale','Offers and promotional emails'],
];
type Preferences = { transactional:boolean; promotional:boolean; categories:EmailCategories };
export default function CommunicationPreferences() {
  const english = useApplicationLocale().startsWith('en');
  const t = (ro:string,en:string) => english ? en : ro;
  const [prefs,setPrefs]=useState<Preferences|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(() => {
    const signal=new AbortController();
    void fetch('/api/v1/communication-preferences',{cache:'no-store',signal:signal.signal})
      .then(r=>{if(!r.ok)throw new Error();return r.json();})
      .then(setPrefs)
      .catch(()=>{if(!signal.signal.aborted)setMessage(english?'Email preferences could not be loaded.':'Preferințele de e-mail nu au putut fi încărcate.');});
    return ()=>signal.abort();
  },[english]);
  return <section className="card">
    <h3>{t('Preferințe e-mail','Email preferences')}</h3>
    <p>{t('Alege ce mesaje opționale primești. Confirmarea adresei, resetarea parolei și alertele de securitate sunt gestionate separat.',
      'Choose which optional messages you receive. Address verification, password resets and security alerts are handled separately.')}</p>
    {prefs && <form className="stack" onSubmit={async event=>{
      event.preventDefault();setBusy(true);setMessage('');
      try {
        const response=await fetch('/api/v1/communication-preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(prefs)});
        if(!response.ok)throw new Error();
        setPrefs(await response.json());
        setMessage(t('Preferințe salvate.','Preferences saved.'));
      } catch { setMessage(t('Salvarea nu a reușit. Reîncearcă.','Could not save. Please try again.')); }
      finally{setBusy(false);}
    }}>
      {fields.map(([key,ro,en])=><label className="check" key={key}><input type="checkbox" disabled={busy}
        checked={prefs.categories[key]} onChange={event=>setPrefs({...prefs,categories:{...prefs.categories,[key]:event.target.checked}})}/>{t(ro,en)}</label>)}
      <label className="check"><input type="checkbox" disabled={busy} checked={prefs.transactional}
        onChange={event=>setPrefs({...prefs,transactional:event.target.checked})}/>
        {t('Informări opționale despre abonament și cont','Optional subscription and account notices')}</label>
      <p className="small muted">{t('Opțiunea generală E-mail din setările de notificări se aplică mesajelor opționale.',
        'The general Email option in notification settings applies to optional messages.')}</p>
      <button disabled={busy}>{t('Salvează preferințele de e-mail','Save email preferences')}</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
