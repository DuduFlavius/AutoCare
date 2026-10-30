'use client';
import { useState } from 'react';
import { Download, FileText, Table2 } from 'lucide-react';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
export default function PremiumDownloads({
  data,
  language,
  preview,
}: {
  data: Data;
  language: 'ro' | 'en';
  preview: boolean;
}) {
  const en = language === 'en',
    [vehicle, setVehicle] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  if (!data.premium) return null;
  async function download(format: 'pdf' | 'csv') {
    if (preview) {
      setError(
        en
          ? 'Downloads are available in your signed-in account.'
          : 'Descărcările sunt disponibile în contul autentificat.',
      );
      return;
    }
    setBusy(format);
    setError('');
    try {
      const query = new URLSearchParams({ format, archived: 'active' });
      if (vehicle) query.set('vehicleId', vehicle);
      const response = await fetch('/api/v1/export?' + query, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json();
        throw Error(payload.error || 'Export failed');
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'autocare-raport.' + format;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="card ac-premium-downloads" data-workspace-ui>
      <h3>
        <Download size={20} />
        {en ? 'Your reports & exports' : 'Rapoartele și exporturile tale'}
      </h3>
      <p className="micro">
        {en
          ? 'Use the PDF with your mechanic or a buyer. CSV contains the selected records for further analysis.'
          : 'Trimite raportul PDF mecanicului sau unui cumpărător. Exportul CSV conține înregistrările selectate pentru analiză.'}
      </p>
      <label>
        {en ? 'Vehicles included' : 'Mașini incluse'}
        <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
          <option value="">{en ? 'All my vehicles' : 'Toate mașinile mele'}</option>
          {data.vehicles.map((car) => (
            <option key={car.id} value={car.id}>
              {car.brand} {car.model} · {car.plate}
            </option>
          ))}
        </select>
      </label>
      <div className="ac-premium-download-actions">
        <button type="button" disabled={!!busy} onClick={() => void download('pdf')}>
          <FileText size={18} />
          {busy === 'pdf'
            ? en
              ? 'Preparing…'
              : 'Se pregătește…'
            : en
              ? 'Download vehicle PDF'
              : 'Descarcă raport auto PDF'}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void download('csv')}>
          <Table2 size={18} />
          {busy === 'csv'
            ? en
              ? 'Preparing…'
              : 'Se pregătește…'
            : en
              ? 'Export CSV data'
              : 'Exportă datele CSV'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="micro">
        {en
          ? 'Account data is synchronized on the server. This export contains records, not a full attachment backup.'
          : 'Datele contului sunt sincronizate pe server. Exportul conține înregistrări, nu un backup complet al atașamentelor.'}
      </p>
    </section>
  );
}
