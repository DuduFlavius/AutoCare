'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { useApplicationLanguage } from './application-locale';
import type { SupportState } from '@/lib/support-availability';

type Pair = { ro: string; en: string };
type Hours = { days: number[]; start: string; end: string };
type Settings = { mode: 'auto'|'offline'|'break'|'maintenance'; hours: Hours | null; messages: Record<SupportState, Pair> };
const labels: Record<SupportState, [string,string]> = {
  available:['Disponibil','Available'], busy:['Ocupat','Busy'], offline:['Indisponibil','Offline'],
  break:['Pauză','Break'], after_hours:['În afara programului','Outside hours'], maintenance:['Mentenanță','Maintenance'],
};
const weekday = [['Lun','Mon'],['Mar','Tue'],['Mie','Wed'],['Joi','Thu'],['Vin','Fri'],['Sâm','Sat'],['Dum','Sun']];
export default function SupportAvailabilitySettings({ accountId }: { accountId: string }) {
  const en = useApplicationLanguage() === 'en', t = (ro: string, english: string) => en ? english : ro;
  const [settings, setSettings] = useState<Settings>();
  const [failure, setFailure] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<SupportState>('offline');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailure('');
    void fetch('/api/v1/support/availability', { cache: 'no-store', signal: controller.signal, headers: { 'X-AutoCare-Account': accountId } })
      .then(async response => {
        if (!response.ok) throw new Error('Support availability unavailable');
        if (!controller.signal.aborted) setSettings(await response.json());
      }).catch(() => { if (!controller.signal.aborted) setFailure(en ? 'Could not load settings.' : 'Setările nu au putut fi încărcate.'); });
    return () => controller.abort();
  }, [accountId, en, revision]);
  return <details className="card sc-availability-settings">
    <summary><Clock3 size={17}/>{t('Disponibilitate și mesaje automate', 'Availability and automated messages')}</summary>
    {!settings && failure && <p role="alert">{failure} <button onClick={()=>setRevision(value=>value+1)}>{t('Reîncearcă', 'Retry')}</button></p>}
    {settings && <form className="sf-inline" aria-busy={busy} onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setFailure('');
      setSaved(false);
      try {
        const response = await fetch('/api/v1/support/availability', { method:'PUT',
          headers: { 'Content-Type':'application/json', 'X-AutoCare-Account': accountId }, body: JSON.stringify(settings) });
        if (!response.ok) throw new Error('Support save failed');
        setSettings(await response.json());
        setSaved(true);
      } catch { setFailure(t('Salvarea a eșuat. Verifică orele, zilele și mesajele.', 'Could not save. Check the hours, days and messages.')); }
      finally { setBusy(false); }
    }} onChange={()=>setSaved(false)}>
      <label>{t('Starea echipei', 'Team status')}<select value={settings.mode} onChange={event=>setSettings({...settings, mode:event.target.value as Settings['mode']})}>
        <option value="auto">{t('Automat, din activitatea echipei', 'Automatic, based on agent activity')}</option>
        {(['offline','break','maintenance'] as const).map(value=><option key={value} value={value}>{labels[value][en ? 1 : 0]}</option>)}
      </select></label>
      <label className="check"><input type="checkbox" checked={!!settings.hours} onChange={event=>setSettings({...settings, hours:event.target.checked ? { days:[1,2,3,4,5],start:'09:00',end:'17:00' } : null})} />
        {t('Folosește programul de lucru · Europe/Bucharest', 'Use support hours · Europe/Bucharest')}
      </label>
      {settings.hours && <fieldset>
        <legend>{t('Programul de lucru', 'Support hours')}</legend>
        <div className="sc-hours"><label>{t('Deschidere','Opening')}<input type="time" required value={settings.hours.start} onChange={event=>setSettings({...settings,hours:{...settings.hours!,start:event.target.value}})} /></label>
        <label>{t('Închidere','Closing')}<input type="time" required value={settings.hours.end} onChange={event=>setSettings({...settings,hours:{...settings.hours!,end:event.target.value}})} /></label></div>
        <div className="sc-weekdays">{weekday.map(([ro,english],index)=><label className="check" key={ro}><input type="checkbox" checked={settings.hours!.days.includes(index+1)} onChange={event=>{
          const hours=settings.hours!;
          setSettings({...settings,hours:{...hours,days:event.target.checked?[...hours.days,index+1]:hours.days.filter(day=>day!==index+1)}});
        }}/>{t(ro,english)}</label>)}</div>
      </fieldset>}
      <label>{t('Mesaj pentru starea','Message for status')}<select value={sample} onChange={event=>setSample(event.target.value as SupportState)}>
        {Object.entries(labels).map(([key, name])=><option key={key} value={key}>{name[en ? 1 : 0]}</option>)}
      </select></label>
      <div className="sc-hours">{(['ro','en'] as const).map(language=><label key={language}>{language==='ro'?'Română':'English'}
        <textarea required maxLength={600} value={settings.messages[sample][language]} onChange={event=>setSettings({
          ...settings, messages:{...settings.messages,[sample]:{...settings.messages[sample],[language]:event.target.value}},
        })}/>
        <small className="sc-message-preview">{t('Mesaj automat','Automated message')} · {settings.messages[sample][language]}</small>
      </label>)}</div>
      <button className="primary" disabled={busy}>{busy?t('Se salvează…','Saving…'):t('Salvează disponibilitatea','Save availability')}</button>
      {failure && <p role="alert">{failure}</p>}{saved && <p role="status">{t('Disponibilitatea a fost salvată.', 'Availability saved.')}</p>}
    </form>}
  </details>;
}
