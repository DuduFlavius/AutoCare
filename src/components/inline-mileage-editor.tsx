'use client';
import {requestConfirmation} from '@/components/premium-dialogs';

import {Gauge} from 'lucide-react';
import {SignatureActions, SignatureDialog, SignatureGroup} from './signature-form';
import {PremiumDateInput} from './premium-date-input';
import { useRef, useState } from 'react';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
export default function InlineMileageEditor({ vehicleId, currentKm, preview, onSaved, triggerLabel }: { vehicleId: string; currentKm: number; preview: boolean; onSaved: () => Promise<void>;triggerLabel?:string }) {
  const en = useApplicationLanguage() === 'en', locale = useApplicationLocale();
  const [open, setOpen] = useState(false), [value, setValue] = useState(String(currentKm));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [date,setDate]=useState(new Date().toLocaleDateString('en-CA'));
  const [notes,setNotes]=useState('');
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const inFlight = useRef(false);
  const target = Number(value), delta = target - currentKm;
  const invalid = value.trim() === '' || !Number.isSafeInteger(target) || target < currentKm || target > 99999999;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || inFlight.current) return;
    if (preview) { setError(en ? 'Preview only. No mileage is saved.' : 'În previzualizare nu se salvează kilometrajul.'); return; }
    if (delta >= 1500 && confirmed !== target) { setConfirmed(target); return; }
    inFlight.current=true;
    if(!await requestConfirmation(en?'Save this confirmed odometer reading?':'Salvezi această citire confirmată a kilometrajului?')){inFlight.current=false;return;}
    setBusy(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/v1/smartdrive/vehicles/' + encodeURIComponent(vehicleId) + '/readings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ odometer: target, date, notes }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || (en ? 'Could not save mileage.' : 'Nu s-a putut salva kilometrajul.'));
      setSaved(true); setOpen(false);
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (en ? 'Please try again.' : 'Încearcă din nou.')); }
    finally { inFlight.current=false;setBusy(false); }
  }
  async function close() {
    if (inFlight.current) return;
    if ((value !== String(currentKm) || notes || date !== new Date().toLocaleDateString('en-CA')) &&
      !await requestConfirmation(en ? 'Discard unsaved mileage changes?' : 'Renunți la modificările nesalvate?')) return;
    setOpen(false);
    setError('');
  }
  const label = busy ? (en ? 'Saving…' : 'Se salvează…') :
    confirmed === target ? (en ? 'Confirm mileage' : 'Confirmă kilometrajul') : (en ? 'Save mileage' : 'Salvează kilometrajul');
  return <div className="ac-inline-mileage" data-workspace-ui>
    <button type="button" disabled={busy || open} onClick={() => {
      setValue(String(currentKm));
      setDate(new Date().toLocaleDateString('en-CA'));
      setNotes('');
      setConfirmed(null);
      setError('');
      setSaved(false);
      setOpen(true);
    }}>{triggerLabel ?? (en ? 'Enter mileage manually' : 'Introdu kilometraj manual')}</button>
    {open && <SignatureDialog title={en ? 'Record mileage' : 'Înregistrează kilometrajul'} icon={Gauge} compact busy={busy} onClose={() => void close()}>
      <form className="sf-form" aria-busy={busy} onSubmit={save}>
        <div className="sf-body">
          <SignatureGroup title={en ? 'Odometer' : 'Citire kilometraj'} icon={Gauge}>
            <small>{en ? 'Previously saved: ' : 'Înregistrat anterior: '}{currentKm.toLocaleString(locale)} km.</small>
            <div className="form-grid">
              <label>{en ? 'Current odometer reading (km)' : 'Kilometrajul actual de pe bord (km)'}
                <input type="number" inputMode="numeric" min={currentKm} max={99999999} step="1" value={value} disabled={busy} onChange={e => { setValue(e.target.value); setConfirmed(null); setError(''); }} required aria-invalid={invalid || undefined}/>
              </label>
              <label>{en?'Reading date':'Data citirii'}<PremiumDateInput type="date" value={date} max={new Date().toLocaleDateString('en-CA')} onChange={event=>setDate(event.target.value)} required disabled={busy}/></label>
              <label className="full">{en?'Notes (optional)':'Observații (opțional)'}<input value={notes} maxLength={500} onChange={event=>setNotes(event.target.value)} disabled={busy}/></label>
            </div>
            {!invalid && delta > 0 && <small>+{delta.toLocaleString(locale)} {en ? 'km since the previous reading' : 'km față de citirea anterioară'}</small>}
            {invalid && <p role="alert">{en ? 'Enter a whole number at least equal to the saved mileage.' : 'Introdu un număr întreg, cel puțin egal cu kilometrajul salvat.'}</p>}
            {confirmed === target && <p role="alert">{en ? 'Large increase. Check the total on your dashboard and confirm.' : 'Creștere mare de kilometraj. Verifică totalul de pe bord și confirmă.'}</p>}
            {error && <p className="sf-error" role="alert">{error}</p>}
          </SignatureGroup>
        </div>
        <SignatureActions busy={busy} disabled={invalid} label={label} onCancel={() => void close()}/>
      </form>
    </SignatureDialog>}
    {saved && <p role="status">{en ? 'Mileage saved. Maintenance estimates recalculated.' : 'Kilometraj salvat. Estimările de întreținere au fost recalculate.'}</p>}
  </div>;
}
