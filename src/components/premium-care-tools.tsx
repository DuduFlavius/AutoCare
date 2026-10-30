'use client';
import { useEffect, useState } from 'react';
import { parseServiceDetails } from '@/lib/service-details';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type LinkRow = { id: string; expiresAt: string; revoked: boolean };
export default function PremiumCareTools({
  data,
  language,
  preview,
  onRecord,
}: {
  data: Data;
  language: 'ro' | 'en';
  preview: boolean;
  onRecord?: (record: Data['records'][number]) => void;
}) {
  const en = language === 'en',
    cars = data.vehicles.filter((v) => !v.archived),
    [vehicle, setVehicle] = useState(cars[0]?.id || ''),
    [ids, setIds] = useState<string[]>([]),
    [days, setDays] = useState(1),
    [files, setFiles] = useState(false),
    [costs, setCosts] = useState(false),
    [links, setLinks] = useState<LinkRow[]>([]),
    [url, setUrl] = useState(''),
    [createdId, setCreatedId] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const records = data.records.filter((r) => r.vehicleId === vehicle && !r.cancelled),
    budgets = data.records.filter(
      (r) =>
        !r.cancelled &&
        cars.some((v) => v.id === r.vehicleId) &&
        parseServiceDetails(r.parts || '').budgetEstimat !== undefined,
    );
  const money = (b: number) =>
    new Intl.NumberFormat(en ? 'en-GB' : 'ro-RO', { style: 'currency', currency: en ? 'EUR' : 'RON' }).format(
      b / 100,
    );
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    fetch('/api/v1/mechanic-shares', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw Error('Nu se pot încărca dosarele.');
        return r.json();
      })
      .then((rows) => {
        if (!cancelled) setLinks(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);
  async function request(path: string, method: string, body?: unknown) {
    if (preview)
      throw Error(
        en ? 'Available in your signed-in account.' : 'Disponibil în contul autentificat.',
      );
    const res = await fetch('/api/v1/' + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await res.json();
    if (!res.ok) throw Error(result.error || 'Operațiunea nu a reușit.');
    return result;
  }
  return (
    <div className="stack" data-workspace-ui>
      <section className="card">
        <h3>{en ? 'Maintenance budgets' : 'Bugetele lucrărilor'}</h3>{en&&<p>EUR amounts are indicative at EUR 1 ≈ RON 5. Saved costs remain in RON.</p>}
        <p>
          {en
            ? 'Estimates are separate from actual expenses. Add a budget when creating or editing maintenance.'
            : 'Estimările sunt separate de cheltuielile reale. Adaugă bugetul la crearea sau editarea unei intervenții.'}
        </p>
        {budgets.length ? (
          budgets.map((r) => {
            const budget = Math.round(
                Number(parseServiceDetails(r.parts || '').budgetEstimat) * 100,
              ),
              delta = r.amountBani - budget;
            return (
              <article className="card" key={r.id} style={{ marginTop: 12, padding: 16 }}>
                <strong data-user-content>{r.title}</strong>
                <p>
                  {en ? 'Budget' : 'Buget'}: {money(budget)} · {en ? 'Actual' : 'Real'}:{' '}
                  {r.amountKnown ? money(r.amountBani) : '—'}
                </p>
                <p>
                  {r.amountKnown
                    ? (delta > 0
                        ? en
                          ? 'Over budget: '
                          : 'Peste buget: '
                        : en
                          ? 'Under budget: '
                          : 'Sub buget: ') + money(Math.abs(delta))
                    : en
                      ? 'Waiting for the actual cost.'
                      : 'Așteaptă costul real.'}
                </p>
                {onRecord && (
                  <button type="button" onClick={() => onRecord(r)}>
                    {en ? 'Edit budget and cost' : 'Editează bugetul și costul'}
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <p>{en ? 'No estimates saved yet.' : 'Nu ai bugete estimate salvate încă.'}</p>
        )}
      </section>
      <section className="card">
        <h3>{en ? 'Temporary mechanic folder' : 'Dosar temporar pentru mecanic'}</h3>
        <p>
          {en
            ? 'Anyone with the link can read only your selected records until expiry. You can revoke access at any time. Notes, VIN and account details are never included.'
            : 'Oricine are linkul poate citi doar înregistrările selectate, până la expirare. Poți revoca accesul oricând. Notițele, VIN-ul și datele contului nu sunt incluse.'}
        </p>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            setUrl('');
            try {
              const out = await request('mechanic-shares', 'POST', {
                vehicleId: vehicle,
                recordIds: ids,
                days,
                includeFiles: files,
                includeCosts: costs,
              });
              setUrl(window.location.origin + '/dosar/' + out.token);
              setCreatedId(out.id);
              setLinks((old) => [{ id: out.id, expiresAt: out.expiresAt, revoked: false }, ...old]);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {en ? 'Vehicle' : 'Mașină'}
            <select
              value={vehicle}
              onChange={(e) => {
                setVehicle(e.target.value);
                setIds([]);
              }}
            >
              {cars.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} · {v.plate}
                </option>
              ))}
            </select>
          </label>
          <fieldset
            style={{
              maxHeight: 300,
              overflow: 'auto',
              border: '1px solid #dce6f2',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <legend>
              {en ? 'Choose records (maximum 100)' : 'Alege înregistrările (maximum 100)'}
            </legend>
            {records.map((r) => (
              <label className="check" key={r.id} style={{ padding: '8px 0' }}>
                <input
                  type="checkbox"
                  checked={ids.includes(r.id)}
                  onChange={(e) =>
                    setIds((old) =>
                      e.target.checked ? [...old, r.id] : old.filter((id) => id !== r.id),
                    )
                  }
                />
                <span data-user-content>
                  {r.title} · {r.date || '—'}
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            {en ? 'Access expires after' : 'Accesul expiră după'}
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>{en ? '24 hours' : '24 de ore'}</option>
              <option value={3}>{en ? '3 days' : '3 zile'}</option>
              <option value={7}>{en ? '7 days' : '7 zile'}</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} />
            {en
              ? 'Include attachments for the selected records'
              : 'Include atașamentele înregistrărilor selectate'}
          </label>
          <label className="check">
            <input type="checkbox" checked={costs} onChange={(e) => setCosts(e.target.checked)} />
            {en ? 'Include recorded costs' : 'Include costurile înregistrate'}
          </label>
          <button disabled={busy || !ids.length || ids.length > 100} type="submit">
            {busy
              ? en
                ? 'Creating…'
                : 'Se creează…'
              : en
                ? 'Create temporary link'
                : 'Creează link temporar'}
          </button>
          {error && <p role="alert">{error}</p>}
          {url && (
            <label>
              {en
                ? 'Copy this link and send it to your mechanic'
                : 'Copiază linkul și trimite-l mecanicului'}
              <input
                aria-label={en ? 'Temporary folder link' : 'Link dosar temporar'}
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
              />
              <small>
                {en
                  ? 'The link is shown only now. Keep it private.'
                  : 'Linkul este afișat doar acum. Păstrează-l privat.'}
              </small>
            </label>
          )}
        </form>
        <h4>{en ? 'Manage links' : 'Gestionează linkurile'}</h4>
        {links.length ? (
          links.map((row) => (
            <div
              className="between"
              style={{ flexWrap: 'wrap', gap: 12, padding: '12px 0' }}
              key={row.id}
            >
              <span>
                {new Date(row.expiresAt).toLocaleString(en ? 'en-GB' : 'ro-RO')} ·{' '}
                {row.revoked
                  ? en
                    ? 'Revoked'
                    : 'Revocat'
                  : new Date(row.expiresAt) <= new Date()
                    ? en
                      ? 'Expired'
                      : 'Expirat'
                    : en
                      ? 'Active'
                      : 'Activ'}
              </span>
              {!row.revoked && (
                <button
                  disabled={busy}
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await request('mechanic-shares/' + row.id, 'DELETE');
                      setLinks((old) =>
                        old.map((l) => (l.id === row.id ? { ...l, revoked: true } : l)),
                      );
                      if (row.id === createdId) setUrl('');
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {en ? 'Revoke access' : 'Revocă accesul'}
                </button>
              )}
            </div>
          ))
        ) : (
          <p>{en ? 'No links created.' : 'Nu ai creat linkuri.'}</p>
        )}
      </section>
    </div>
  );
}
