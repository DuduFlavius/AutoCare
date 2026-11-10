'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardList, LockKeyhole, Sparkles, UserRound, X } from 'lucide-react';

export async function supportRequest(path: string, init?: RequestInit) {
  const response = await fetch('/api/v1/support/' + path, { cache: 'no-store', ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(result.error || 'Operațiunea nu a reușit.');
  return result;
}
const json = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
type Context = {
  customer: { name: string; email: string; createdAt: string; verified: boolean };
  premium: boolean; suspended: boolean; vehicleCount: number;
  threads: { id: string; status: string; createdAt: string }[];
  notes: { id: string; body: string; author: string | null; createdAt: string }[];
  events: { id: string; action: string; author: string | null; createdAt: string }[];
  operations: { priority: string; workflow: string; rating: number | null } | null;
};
type Stats = { active: number; resolved: number; unread: number; responseSeconds: number | null; resolutionSeconds: number | null; ratings: number; satisfaction: number | null; activity: { name: string; count: number }[] };
const states: Record<string, string> = { open: 'Activă', completed: 'Rezolvată', trashed: 'În coș' };
const auditLabels: Record<string, string> = {
  'support.assigned': 'Atribuire', 'support.complete': 'Finalizare', 'support.trash': 'Mutare în coș',
  'support.restore': 'Restaurare', 'support.reopen': 'Redeschidere', 'support.workflow': 'Actualizare prioritate sau status',
  'support.internal_note': 'Notă internă', 'support.sent': 'Mesaj trimis',
};

export function SupportStatistics({ preview }: { preview: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  function toggle() {
    setOpen(!open);
    if (open || preview) return;
    setError(''); setData(null);
    void supportRequest('statistics').then(setData).catch(error => setError(error.message));
  }
  const duration = (seconds: number | null) => seconds == null ? '—' : seconds < 60 ? seconds + ' s' : Math.round(seconds / 60) + ' min';
  return <div className="support-stats-block">
    <button type="button" aria-expanded={open} onClick={toggle}><ClipboardList size={16} /> Statistici suport</button>
    {open && <section aria-label="Statistici suport">
      {error ? <p role="alert">{error}</p> : !data ? <p role="status">{preview ? 'Datele apar în centrul de suport al echipei.' : 'Se calculează statisticile…'}</p> : <>
        <dl className="support-kpis">
          {[
            ['Active', data.active], ['Rezolvate', data.resolved], ['Necitite pentru tine', data.unread],
            ['Primul răspuns', duration(data.responseSeconds)], ['Rezolvare medie', duration(data.resolutionSeconds)],
            ['Satisfacție', data.satisfaction == null ? '—' : data.satisfaction + '/5 · ' + data.ratings + ' evaluări'],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <h3>Răspunsuri ale echipei în ultimele 7 zile</h3>
        {data.activity.length ? <ul>{data.activity.map((operator, index) => <li key={index}>{operator.name} · {operator.count}</li>)}</ul> : <p>Nu există răspunsuri în acest interval.</p>}
      </>}
    </section>}
  </div>;
}

export function SupportCustomerPanel({ id, editable, assignedName, transfer, onChange, onClose, openHistory, locale }: {
  id: string; editable: boolean; assignedName: string;
  transfer?: { value: string; team: { id: string; name: string }[]; onAssign: (id: string) => Promise<void> };
  onChange: () => Promise<void>; onClose: () => void; openHistory: (id: string, status: string) => void; locale: string;
}) {
  const [data, setData] = useState<Context | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void supportRequest('chat/' + id + '/context', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id, revision]);
  async function update(payload: unknown) {
    setPending(true); setError('');
    try {
      await supportRequest('chat/' + id + '/operations', json(payload));
      setRevision(value => value + 1);
      await onChange();
      return true;
    } catch (error) { setError((error as Error).message); return false; }
    finally { setPending(false); }
  }
  return <aside className="support-customer-panel" id="support-customer-panel" aria-label="Profil client">
    <header><span><UserRound size={19} /> Profil client</span><button type="button" onClick={onClose} aria-label="Ascunde profilul"><X size={17} /></button></header>
    {error && <p role="alert">{error}</p>}
    {!data ? !error && <p role="status">Se încarcă profilul…</p> : <>
      <div className="support-customer-card"><h3 data-user-content>{data.customer.name}</h3><p data-user-content>{data.customer.email}</p>
        <dl><div><dt>Abonament</dt><dd>{data.premium ? 'Premium' : 'Gratuit'}</dd></div>
          <div><dt>Înregistrare</dt><dd>{new Date(data.customer.createdAt).toLocaleDateString(locale)}</dd></div>
          <div><dt>Vehicule active</dt><dd>{data.vehicleCount}</dd></div>
          <div><dt>Status cont</dt><dd>{data.suspended ? 'Suspendat' : data.customer.verified ? 'Verificat' : 'Email neconfirmat'}</dd></div>
          <div><dt>Responsabil</dt><dd>{assignedName}</dd></div>
          {data.operations?.rating != null && <div><dt>Evaluare client</dt><dd>{data.operations.rating}/5</dd></div>}
        </dl>
      </div>
      {transfer && <label>Responsabil conversație<select value={transfer.value} disabled={pending} onChange={event => void transfer.onAssign(event.target.value)}>
        <option value="">Fără responsabil</option>{transfer.team.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select></label>}
      <div className="support-operations-controls">
        <label>Prioritate<select value={data.operations?.priority ?? 'normal'} disabled={!editable || pending} onChange={event => void update({ priority: event.target.value })}>
          <option value="normal">Normală</option><option value="high">Ridicată</option><option value="urgent">Urgentă</option>
        </select></label>
        <label>Flux de lucru<select value={data.operations?.workflow ?? 'working'} disabled={!editable || pending} onChange={event => void update({ workflow: event.target.value })}>
          <option value="working">În lucru</option><option value="waiting">În așteptare</option>
        </select></label>
      </div>
      <details><summary><LockKeyhole size={15} /> Note interne · {data.notes.length}</summary>
        {editable && <form onSubmit={async event => { event.preventDefault(); if (await update({ note })) setNote(''); }}>
          <textarea aria-label="Notă internă" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={2} required />
          <button disabled={pending || !note.trim()}>Salvează nota</button>
        </form>}
        {data.notes.map(item => <article className="support-internal-note" key={item.id}><strong>{item.author ?? 'Fost membru al echipei'}</strong><p data-user-content>{item.body}</p><time>{new Date(item.createdAt).toLocaleString(locale)}</time></article>)}
      </details>
      <details><summary>Istoric conversații</summary><ul>{data.threads.map(thread => <li key={thread.id}><button type="button" disabled={thread.id === id} onClick={() => openHistory(thread.id, thread.status)}>{new Date(thread.createdAt).toLocaleDateString(locale)} · {states[thread.status]}</button></li>)}</ul></details>
      <details><summary>Istoric acțiuni echipă</summary><ul>{data.events.map(event => <li key={event.id}>{auditLabels[event.action] ?? event.action} · {event.author ?? 'Echipă'} <time>{new Date(event.createdAt).toLocaleString(locale)}</time></li>)}</ul></details>
    </>}
  </aside>;
}

export function SupportAiDraft({ available, onDraft }: { available: boolean; onDraft?: (value: string) => void }) {
  const [brief, setBrief] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function generate(event: FormEvent) {
    event.preventDefault();
    setPending(true); setAnswer(''); setError('');
    try { setAnswer((await supportRequest(onDraft ? 'draft' : 'guide', json({ brief }))).answer); }
    catch (error) { setError((error as Error).message); }
    finally { setPending(false); }
  }
  return <details className="support-ai-draft">
    <summary><Sparkles size={16} /> AI Support Assistant</summary>
    {!available ? <p>Furnizorul AI nu este configurat.</p> : <form onSubmit={generate}>
      <label>Descrie problema, fără date personale sau credențiale<textarea value={brief} onChange={event => setBrief(event.target.value)} minLength={8} maxLength={600} rows={2} required /></label>
      <small>Doar textul scris aici este trimis furnizorului AI. {onDraft ? 'Verifică propunerea înainte de trimitere.' : 'Pentru acces la cont și cazuri specifice, scrie echipei.'}</small>
      <button disabled={pending || brief.trim().length < 8}>{pending ? 'Se generează…' : onDraft ? 'Generează propunerea' : 'Întreabă asistentul'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {answer && <div><p data-user-content>{answer}</p>{onDraft && <button type="button" onClick={() => onDraft(answer.slice(0, 4000))}>Folosește în editor</button>}</div>}
  </details>;
}
