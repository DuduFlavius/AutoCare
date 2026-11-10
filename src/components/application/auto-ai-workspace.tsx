'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, FileScan, MapPin, Send, Sparkles, Trash2, Bot, ShieldCheck } from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { TitaniumWave } from '../titanium-wave';
import './auto-ai.css';

type Vehicle = Awaited<ReturnType<typeof dashboard>>['vehicles'][number];
type Turn = { id: string; question: string; answer: string; createdAt: string };
type Mode = 'chat' | 'analysis' | 'monthly' | 'annual' | 'finance' | 'maintenance';
const categories = ['RCA', 'ITP', 'Rovinietă', 'CASCO', 'Talon', 'Alt document'];
type Scan = { category: string; number: string; date: string; expiresAt: string; amountRon: string };
async function request(path: string, init?: RequestInit) {
  const response = await fetch('/api/v1/' + path, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'Cererea nu a putut fi finalizată.');
  return data;
}
const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function AutoAiWorkspace({ vehicles, vehicleId, onVehicle, premium, available, preview, onSaved }: {
  vehicles: Vehicle[]; vehicleId: string; onVehicle: (id: string) => void; premium: boolean;
  available: boolean; preview: boolean; onSaved: () => Promise<void>;
}) {
  const en = useApplicationLanguage() === 'en';
  return (
    <div className="ac-ai-page" data-workspace-ui>
      <header className="ac-ai-hero"><TitaniumWave /><span className="ac-ai-icon"><Sparkles size={25} /></span><div><small>AUTOCARE PREMIUM</small><h2>{en ? 'Your vehicle assistant' : 'Asistentul tău auto'}</h2><p>{en ? 'Your personal automotive AI. Ask anything, naturally.' : 'Discută natural despre orice problemă auto. AI-ul cunoaște și istoricul mașinii tale.'}</p></div></header>
      {!premium ? <section className="card"><p>{en ? 'AutoCare AI is included in Premium.' : 'AutoCare AI este inclus în Premium.'}</p><a className="button primary" href="/cont?tab=Premium">Premium <ArrowUpRight size={15} /></a></section>
        : !vehicles.length ? <section className="card"><p>{en ? 'Add a vehicle first.' : 'Adaugă întâi un vehicul.'}</p><a className="button" href="/cont?tab=Garaj">{en ? 'My garage' : 'Garajul meu'}</a></section>
        : <>
          <label className="ac-ai-vehicle">{en ? 'Vehicle' : 'Vehicul'}
            <select value={vehicleId} onChange={event => onVehicle(event.target.value)}>
              {vehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plate}</option>)}
            </select>
          </label>
          <AiConversation key={vehicleId} vehicleId={vehicleId} available={available} preview={preview} onSaved={onSaved} />
        </>}
    </div>
  );
}

function AiConversation({ vehicleId, available, preview, onSaved }: { vehicleId: string; available: boolean; preview: boolean; onSaved: () => Promise<void> }) {
  const language = useApplicationLanguage();
  const locale = useApplicationLocale();
  const en = language === 'en';
  const t = (ro: string, english: string) => en ? english : ro;
  const [turns, setTurns] = useState<Turn[]>([]);
  const visibleTurns = turns.filter(turn => !/^Analiză locală\s*[·:]/i.test(turn.answer.trim()));
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scan, setScan] = useState<Scan | null>(null);
  const action = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLLIElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns.length, pending]);

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    request('auto-assistant/history?vehicleId=' + encodeURIComponent(vehicleId), { signal: controller.signal })
      .then(data => setTurns(data.turns)).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); action.current?.abort(); };
  }, [vehicleId, preview]);

  async function run(task: (signal: AbortSignal) => Promise<void>) {
    if (preview || action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setPending(true); setError(''); setNotice('');
    try { await task(controller.signal); }
    catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { action.current = null; if (!controller.signal.aborted) setPending(false); }
  }

  function ask(value: string, mode: Mode = 'chat') {
    if (preview || loading || value.trim().length < 1) return;
    void run(async signal => {
      const data = await request('auto-assistant', { ...json('POST', { vehicleId, question: value, language, mode, localFallback: false }), signal });
      setTurns(previous => [...previous, data.turn].slice(-30));
      setQuestion('');
    });
  }

  function extract(file: File) {
    if (!available) return;
    if (file.size > 2097152) { setError(t('Maximum 2 MB per fișier.', 'Maximum 2 MB per file.')); return; }
    void run(async signal => {
      const form = new FormData();
      form.set('file', file);
      form.set('vehicleId', vehicleId);
      const data = await request('auto-assistant/scan', { method: 'POST', body: form, signal });
      setScan({ category: data.category, number: data.number ?? '', date: data.date ?? '', expiresAt: data.expiresAt ?? '', amountRon: data.amountRon == null ? '' : String(data.amountRon) });
    });
  }

  function saveScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scan) return;
    void run(async signal => {
      await request('records', { ...json('POST', {
        kind: 'document', vehicleId, category: scan.category, title: scan.category, number: scan.number || null,
        date: scan.date || null, expiresAt: scan.expiresAt || null, amountKnown: scan.amountRon !== '',
        amountBani: scan.amountRon === '' ? 0 : Math.round(Number(scan.amountRon) * 100),
      }), signal });
      setScan(null);
      setNotice(t('Documentul a fost salvat în dosarul mașinii.', 'The document was saved to your vehicle folder.'));
      await onSaved();
    });
  }

  const suggestions = [
    t('Am o problemă cu mașina. Mă ajuți să înțeleg ce se întâmplă?', 'I have a car problem. Can you help me figure it out?'),
    t('Cât am cheltuit anul acesta și unde pot reduce costurile?', 'What have I spent this year and where could I save?'),
    t('Ce poate însemna un martor aprins în bord?', 'What does a dashboard warning light mean?'),
    t('Ce ar trebui să verific înainte de un drum lung?', 'What should I check before a long trip?'),
  ];
  return (
    <div className="ac-ai-layout">
      <section className="card ac-ai-chat" aria-label={t('Conversație AutoCare AI', 'AutoCare AI conversation')}>
        <div className="ac-ai-heading"><h3><Bot size={20} /> {t('Conversație', 'Conversation')}</h3><span className="ac-ai-online"><span /> Gemini AI</span>
          {turns.length > 0 && <button type="button" disabled={pending || loading} onClick={() => {
            if (window.confirm(t('Ștergi istoricul AI pentru această mașină?', 'Clear AI history for this vehicle?')))
              void run(async signal => { await request('auto-assistant/history', { ...json('DELETE', { vehicleId }), signal }); setTurns([]); });
          }}><Trash2 size={16} />{t('Șterge istoricul', 'Clear history')}</button>}
        </div>
        {!available && <p className="ac-ai-state" role="status">{t('Conexiunea AI nu este configurată. Contactează administratorul.', 'AI is not configured. Contact support.')}</p>}
        {loading ? <p role="status">{t('Se încarcă istoricul…', 'Loading history…')}</p> :
          visibleTurns.length ? <ol className="ac-ai-turns" aria-live="polite">{visibleTurns.map(turn => <li key={turn.id}><p className="ac-ai-question" data-user-content>{turn.question}</p><div className="ac-ai-answer"><strong><Sparkles size={16} /> {t('Asistent', 'Assistant')}</strong><div className="ac-ai-message-body" data-user-content>{turn.answer.split('\n').map((line, index) => /^#{1,4}\s/.test(line) ? <h4 key={index}>{line.replace(/^#{1,4}\s*/, '')}</h4> : <p key={index}>{line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => part.startsWith('**') && part.endsWith('**') ? <b key={partIndex}>{part.slice(2, -2)}</b> : part)}</p>)}</div><time dateTime={turn.createdAt}>{new Date(turn.createdAt).toLocaleString(locale)}</time></div></li>)}<li className="ac-ai-scroll-anchor" ref={bottom} aria-hidden="true" /></ol>
            : <div className="ac-ai-welcome"><span className="ac-ai-welcome-icon"><Sparkles size={26} /></span><h3>{t('Salut! Cu ce te pot ajuta?', 'Hi! How can I help?')}</h3><p>{t('Sunt asistentul tău auto. Povestește-mi ce se întâmplă sau alege o întrebare pentru început.', 'I am your car assistant. Tell me what is happening or choose a question to get started.')}</p><div className="ac-ai-suggestions">{suggestions.map(value => <button key={value} type="button" disabled={preview || pending} onClick={() => { setQuestion(value); input.current?.focus(); }}><Sparkles size={16} />{value}<ArrowUpRight size={14} /></button>)}</div></div>}
        <form className="ac-ai-composer" onSubmit={event => { event.preventDefault(); ask(question); }}>
          <textarea ref={input} aria-label={t('Întrebarea ta', 'Your question')} placeholder={t('Scrie orice întrebare…', 'Ask me anything about your car…')} rows={2} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(question); } }} minLength={1} maxLength={600} value={question} onChange={event => setQuestion(event.target.value)} required disabled={preview || pending} />
          <button className="primary" type="submit" disabled={preview || pending || loading || question.trim().length < 1}><Send size={17} />{t('Trimite', 'Send')}</button>
        </form>
        {pending && <p className="ac-ai-typing" role="status"><span className="ac-ai-typing-dots"><i/><i/><i/></span> {t('Se pregătește răspunsul…', 'Thinking…')}</p>}
        {error && <p className="ac-ai-inline-error" role="alert">{error}</p>}
        <small className="ac-ai-privacy"><ShieldCheck size={14} /> {t('Asistent AI. Recomandările nu înlocuiesc un diagnostic în service.', 'AI assistant. Advice does not replace a professional inspection.')}</small>
        {available && <small>{t('Întrebarea, istoricul recent și datele relevante ale mașinii sunt trimise furnizorului AI. Evită datele personale.', 'The question, recent history and relevant vehicle data are sent to the AI provider. Avoid personal information.')}</small>}
      </section>
      <aside className="ac-ai-tools">
        <section className="card"><h3><Sparkles size={18} /> {t('Analiză și rapoarte', 'Analysis and reports')}</h3>
          {([
            ['analysis', t('Analizează mașina', 'Analyze vehicle')],
            ['finance', t('Compară cheltuielile lunare', 'Compare monthly expenses')],
            ['monthly', t('Generează raportul lunii curente', 'Generate current month report')],
            ['annual', t('Generează raportul anului curent', 'Generate current year report')],
          ] as const).map(([mode, label]) => <button key={mode} type="button" disabled={preview || pending || loading} onClick={() => ask(label, mode)}>{label} <ArrowUpRight size={14} /></button>)}
          <a href="/cont?tab=Plan+%C3%AEntre%C8%9Binere&drive=points#service-finder" className="button"><MapPin size={17} /> Service Finder</a>
        </section>
        <section className="card"><h3><FileScan size={18} /> {t('Scanează un document', 'Scan a document')}</h3>
          <p>{t('PDF, JPEG sau PNG, maximum 2 MB. Fișierul ales este trimis furnizorului AI pentru extragere.', 'PDF, JPEG or PNG, maximum 2 MB. The selected file is sent to the AI provider for extraction.')}</p>
          <input type="file" aria-label={t('Alege documentul pentru scanare', 'Select a document to scan')} accept="application/pdf,image/png,image/jpeg" disabled={!available || pending} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (file) extract(file);
          }} />
          {scan && <form className="ac-ai-scan" onSubmit={saveScan}>
            <p>{t('Verifică și corectează rezultatele înainte de salvare.', 'Review and correct the extracted fields before saving.')}</p>
            <label>{t('Tip document', 'Document type')}<select value={scan.category} onChange={e => setScan({ ...scan, category: e.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>{t('Număr document', 'Document number')}<input maxLength={120} value={scan.number} onChange={e => setScan({ ...scan, number: e.target.value })} /></label>
            <label>{t('Emitere', 'Issue date')}<input type="date" value={scan.date} onChange={e => setScan({ ...scan, date: e.target.value })} /></label>
            <label>{t('Expirare', 'Expiry date')}<input type="date" min={scan.date || undefined} required={scan.category === 'RCA'} value={scan.expiresAt} onChange={e => setScan({ ...scan, expiresAt: e.target.value })} /></label>
            <label>{t('Cost în RON', 'Cost in RON')}<input type="number" min="0" max="1000000" step=".01" value={scan.amountRon} onChange={e => setScan({ ...scan, amountRon: e.target.value })} /></label>
            <button className="primary" disabled={pending}>{t('Confirmă și salvează', 'Confirm and save')}</button>
            <button type="button" disabled={pending} onClick={() => setScan(null)}>{t('Renunță', 'Cancel')}</button>
          </form>}
        </section>
        <div aria-live="polite" className="ac-ai-feedback">{pending && <p>{t('Se procesează…', 'Processing…')}</p>}{notice && <p>{notice}</p>}{error && <p role="alert">{error}</p>}</div>
      </aside>
    </div>
  );
}
