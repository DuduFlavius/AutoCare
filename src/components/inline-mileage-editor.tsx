'use client';
import { useState } from 'react';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
export default function InlineMileageEditor({ vehicleId, currentKm, preview, onSaved }: { vehicleId: string; currentKm: number; preview: boolean; onSaved: () => Promise<void> }) {
  const en = useApplicationLanguage() === 'en', locale = useApplicationLocale();
  const [open, setOpen] = useState(false), [value, setValue] = useState(String(currentKm));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const target = Number(value), delta = target - currentKm;
  const invalid = value.trim() === '' || !Number.isSafeInteger(target) || target < currentKm || target > 99999999;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || busy) return;
    if (preview) { setError(en ? 'Preview only. No mileage is saved.' : 'În previzualizare nu se salvează kilometrajul.'); return; }
    if (delta >= 1500 && confirmed !== target) { setConfirmed(target); return; }
    setBusy(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/v1/smartdrive/vehicles/' + encodeURIComponent(vehicleId) + '/readings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ odometer: target }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || (en ? 'Could not save mileage.' : 'Nu s-a putut salva kilometrajul.'));
      setSaved(true); setOpen(false);
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (en ? 'Please try again.' : 'Încearcă din nou.')); }
    finally { setBusy(false); }
  }
  return <div className="ac-inline-mileage" data-workspace-ui>
    {!open && <button type="button" disabled={busy} onClick={() => { setValue(String(currentKm)); setConfirmed(null); setError(''); setSaved(false); setOpen(true); }}>{en ? 'Update mileage' : 'Actualizează kilometrajul'}</button>}
    {open && <form onSubmit={save}>
      <label>{en ? 'Current odometer reading (km)' : 'Kilometrajul actual de pe bord (km)'}
        <input type="number" inputMode="numeric" min={currentKm} max={99999999} step="1" value={value} disabled={busy} onChange={e => { setValue(e.target.value); setConfirmed(null); setError(''); }} autoFocus required aria-invalid={invalid || undefined}/>
      </label>
      <small>{en ? 'Previously saved: ' : 'Înregistrat anterior: '}{currentKm.toLocaleString(locale)} km. {en ? 'Enter the total on the dashboard, not just the kilometers driven.' : 'Introdu totalul de pe bord, nu doar kilometrii parcurși.'}</small>
      {!invalid && delta > 0 && <small>+{delta.toLocaleString(locale)} {en ? 'km since the previous reading' : 'km față de citirea anterioară'}</small>}
      {invalid && <p role="alert">{en ? 'Enter a whole number at least equal to the saved mileage.' : 'Introdu un număr întreg, cel puțin egal cu kilometrajul salvat.'}</p>}
      {confirmed === target && <p role="alert">{en ? 'Large increase. Check the total on your dashboard and confirm.' : 'Creștere mare de kilometraj. Verifică totalul de pe bord și confirmă.'}</p>}
      <div><button type="submit" disabled={invalid || busy}>{busy ? (en ? 'Saving…' : 'Se salvează…') : confirmed === target ? (en ? 'Confirm mileage' : 'Confirmă kilometrajul') : (en ? 'Save mileage' : 'Salvează kilometrajul')}</button>
      <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>{en ? 'Cancel' : 'Anulează'}</button></div>
    </form>}
    {saved && <p role="status">{en ? 'Mileage saved. Maintenance estimates recalculated.' : 'Kilometraj salvat. Estimările de întreținere au fost recalculate.'}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
