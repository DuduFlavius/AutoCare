'use client';
import { useState } from 'react';
import { useApplicationLanguage } from './application-locale';
import type { useMileageUsage } from './use-mileage-usage';
export default function DailyMileageInput({ usage }: { usage: ReturnType<typeof useMileageUsage> }) {
  const en = useApplicationLanguage() === 'en';
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const value = draft ?? (usage.manualDailyKm?.toString() ?? '');
  const parsed = Number(value.replace(',', '.'));
  const invalid = value !== '' && (!Number.isFinite(parsed) || parsed < 1 || parsed > 2000);
  async function save() {
    if (invalid || busy) return;
    setBusy(true); setMessage('');
    try {
      await usage.saveDailyKm(value === '' ? null : parsed);
      setDraft(null);
      setMessage(en ? 'Saved for this vehicle.' : 'Salvat pentru această mașină.');
    } catch { setMessage(en ? 'Could not save. Please try again.' : 'Nu s-a salvat. Încearcă din nou.'); }
    finally { setBusy(false); }
  }
  return <details className="ac-daily-usage" data-workspace-ui>
    <summary>{usage.manualDailyKm !== null ? `${usage.manualDailyKm} ${en ? 'km/day · Edit average' : 'km/zi · Modifică media'}` : (en ? 'Set daily mileage' : 'Setează kilometrii pe zi')}</summary>
    <span className="ac-daily-usage-body">
    <label><span>{en ? 'Your daily average · km/day' : 'Media ta zilnică · km/zi'}</span>
      <input type="number" inputMode="decimal" min="1" max="2000" step="any" value={value}
        placeholder={usage.confirmed?.dailyKm?.toFixed(1) ?? (en ? 'e.g. 70' : 'ex. 70')}
        disabled={busy} onChange={(e) => { setDraft(e.target.value); setMessage(''); }} aria-invalid={invalid || undefined}/>
    </label>
    <button type="button" onClick={save} disabled={invalid || busy || draft === null}>{busy ? (en ? 'Saving…' : 'Se salvează…') : (en ? 'Save average' : 'Salvează media')}</button>
    <small>{en ? 'Shared by oil, timing and all maintenance estimates. Clear and save to use recorded mileage instead.' : 'Aceeași medie pentru ulei, distribuție și toate estimările. Golește și salvează pentru media din citiri.'}</small>
    {invalid && <small role="alert">{en ? 'Enter 1–2,000 km/day.' : 'Introdu între 1 și 2.000 km/zi.'}</small>}
    {message && <small role="status">{message}</small>}
  </span></details>;
}
