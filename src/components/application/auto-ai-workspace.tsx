'use client';
import {PremiumDateInput} from '@/components/premium-date-input';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, FileScan, MapPin, Sparkles, Trash2, ShieldCheck, Copy, ChevronDown, MessageSquareText, Wrench, CalendarDays, BarChart3, CheckCheck, MoreHorizontal, Square, RotateCcw, ThumbsUp, ThumbsDown, Paperclip, History, CarFront, X, ArrowUp } from 'lucide-react';
import { conversationGroups, conversationKey, type AiTurn } from '@/lib/ai-conversations';
import type { dashboard } from '@/lib/service';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { TitaniumWave } from '../titanium-wave';
import { AiMarkdown } from './ai-markdown';
import './auto-ai.css';
import './auto-ai-premium.css';

type Vehicle = Awaited<ReturnType<typeof dashboard>>['vehicles'][number];
type Turn = AiTurn;
type Mode = 'chat' | 'analysis' | 'monthly' | 'annual' | 'finance' | 'maintenance';
const categories = ['RCA', 'ITP', 'Rovinietă', 'CASCO', 'Talon', 'Alt document'];
type Scan = { category: string; number: string; date: string; expiresAt: string; amountRon: string };
async function request(path: string, init?: RequestInit) {
  const response = await fetch('/api/v1/' + path, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'Cererea nu a putut fi finalizată.');
  return data;
}
function requestErrorEnglish(message: string) {
  if (/limit|429/i.test(message)) return 'The request limit has been reached. Please try again later.';
  if (/Premium/i.test(message)) return 'An active Premium subscription is required.';
  if (/configurat|API|Gemini|furnizor/i.test(message)) return 'The AI service is temporarily unavailable. Please try again later.';
  if (/PDF|document|fișier/i.test(message)) return 'The document could not be processed. Use a clear PDF, JPEG or PNG, up to 2 MB.';
  return 'The request could not be completed. Please try again.';
}
const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function AutoAiWorkspace({ vehicles, vehicleId, onVehicle, premium, pricing, available, preview, onSaved }: {
  vehicles: Vehicle[]; vehicleId: string; onVehicle: (id: string) => void; premium: boolean;
  pricing?: Awaited<ReturnType<typeof dashboard>>['pricing']; available: boolean; preview: boolean; onSaved: () => Promise<void>;
}) {
  const en = useApplicationLanguage() === 'en';
  const page = useRef<HTMLDivElement>(null);
  const hasChat = premium && vehicles.length > 0;
  useLayoutEffect(() => {
    const element = page.current;
    if (!element || !hasChat) return;
    let frame = 0;
    let previousHeight = -1;
    const update = () => {
      frame = 0;
      const viewport = window.visualViewport;
      const bottom = (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0);
      element.style.setProperty('--ai-viewport-top', (viewport?.offsetTop ?? 0) + 'px');
      const navigation = document.querySelector<HTMLElement>('.autocare-mobile-dock');
      const navRect = navigation?.getBoundingClientRect();
      const reserved = navRect && navRect.height && navRect.top < bottom && getComputedStyle(navigation!).position === 'fixed' ? bottom - navRect.top : 0;
      const height = Math.max(180, bottom - element.getBoundingClientRect().top - reserved - 12);
      if (Math.abs(height - previousHeight) < 1) return;
      previousHeight = height;
      element.style.setProperty('--ai-page-height', height + 'px');
      element.toggleAttribute('data-compact-chat', height < 420);
    };
    update();
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.querySelector('header') ?? element);
    const dock = document.querySelector('.autocare-mobile-dock');
    if (dock) observer.observe(dock);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule); };
  }, [hasChat]);
  return (
    <div ref={page} className="ac-ai-page" data-chat={hasChat || undefined} data-workspace-ui>
      <header className="ac-ai-hero"><TitaniumWave /><span className="ac-ai-icon"><Sparkles size={25} /></span><div><small>AUTOCARE PREMIUM</small><h2>AutoCare AI</h2><p>{en ? 'Your personal automotive AI. Ask anything, naturally.' : 'Discută natural despre orice problemă auto. AI-ul cunoaște și istoricul mașinii tale.'}</p></div></header>
      {!premium ? <section className="card ac-ai-membership-gate" aria-labelledby="ai-membership-title"><span className="ac-ai-icon"><Sparkles size={30}/></span><h2 id="ai-membership-title">{en?'AutoCare AI — Your intelligent car assistant':'AutoCare AI — Asistentul tău auto inteligent'}</h2><p>{en?'AutoCare AI is exclusively available to Premium members. Activate Premium to understand your vehicle information and receive helpful recommendations.':'AutoCare AI este o funcție exclusivă pentru membrii Premium. Activează Premium pentru a înțelege mai ușor informațiile despre mașina ta și pentru recomandări utile.'}</p><ul><li>{en?'Understand recorded vehicle costs':'Înțelege costurile înregistrate ale mașinii'}</li><li>{en?'Prepare maintenance using your saved history':'Pregătește întreținerea folosind istoricul salvat'}</li><li>{en?'Extract document details and confirm before saving':'Extrage date din documente și confirmă înainte de salvare'}</li></ul><div className="ac-ai-gate-actions"><a className="button primary" href="/cont?tab=Premium">{en?'Activate Premium':'Activează Premium'} <ArrowUpRight size={15}/></a><a className="button" href="/cont?tab=Dashboard">{en?'Back to Dashboard':'Înapoi la Dashboard'}</a></div>{pricing&&<p className="small">{new Intl.NumberFormat(en?'en-GB':'ro-RO',{style:'currency',currency:pricing.currency}).format(pricing.monthlyBani/100)} {en?'/ month':'/ lună'}</p>}<p className="small muted">{en?'Already had Premium? Reactivate it to continue. Expiry does not automatically delete your chat history.':'Ai avut Premium? Reactivează-l pentru a continua. Expirarea nu șterge automat istoricul conversațiilor.'}</p></section>
        : !vehicles.length ? <section className="card"><p>{en ? 'Add a vehicle first.' : 'Adaugă întâi un vehicul.'}</p><a className="button" href="/cont?tab=Garaj">{en ? 'My garage' : 'Garajul meu'}</a></section>
        : <>
          <label className="ac-ai-vehicle">{en ? 'Vehicle' : 'Vehicul'}
            <select value={vehicleId} onChange={event => onVehicle(event.target.value)}>
              {vehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plate}</option>)}
            </select>
          </label>
          <AiConversation key={vehicleId} vehicleName={vehicles.find(vehicle => vehicle.id === vehicleId)?.brand + ' ' + vehicles.find(vehicle => vehicle.id === vehicleId)?.model} vehicleId={vehicleId} available={available} preview={preview} onSaved={onSaved} />
        </>}
    </div>
  );
}

function AiConversation({ vehicleId, vehicleName, available, preview, onSaved }: { vehicleId: string; vehicleName: string; available: boolean; preview: boolean; onSaved: () => Promise<void> }) {
  const language = useApplicationLanguage();
  const locale = useApplicationLocale();
  const en = language === 'en';
  const t = (ro: string, english: string) => en ? english : ro;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const groups = conversationGroups(turns);
  const selectedGroup = groups.find(group => group.id === activeConversation);
  const visibleTurns = selectedGroup?.turns ?? [];
  const [pendingQuestion, setPendingQuestion] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (!notice) return; noticeTimer.current = setTimeout(() => setNotice(''), 4500); return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }; }, [notice]);
  useEffect(() => {
    if (!historyOpen && !toolsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setHistoryOpen(false); setToolsOpen(false); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [historyOpen, toolsOpen]);
  const [scan, setScan] = useState<Scan | null>(null);
  const action = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(()=>{const field=input.current;if(!field)return;field.style.setProperty('height','auto','important');field.style.setProperty('height',Math.min(120,field.scrollHeight)+'px','important');field.style.setProperty('overflow-y',field.scrollHeight>120?'auto':'hidden','important');},[question]);
  const messageScroll = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);
  useEffect(() => { if (autoScroll.current && messageScroll.current) messageScroll.current.scrollTo({ top: messageScroll.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }, [turns.length, pending, activeConversation]);

  useEffect(() => {
    try { const draft = sessionStorage.getItem('autocare-ai-draft:' + vehicleId); if (draft) { setQuestion(draft.slice(0,600)); sessionStorage.removeItem('autocare-ai-draft:' + vehicleId); } } catch { /* Storage is optional. */ }
    if (preview) return;
    const controller = new AbortController();
    request('auto-assistant/history?vehicleId=' + encodeURIComponent(vehicleId), { signal: controller.signal })
      .then(data => { setTurns(data.turns); setActiveConversation(conversationGroups(data.turns)[0]?.id ?? crypto.randomUUID()); }).catch(e => { if (!controller.signal.aborted) setError(en ? requestErrorEnglish(e.message) : e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); action.current?.abort(); };
  }, [vehicleId, preview]);

  async function run(task: (signal: AbortSignal) => Promise<void>) {
    if (preview || action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setPending(true); setError(''); setNotice('');
    try { await task(controller.signal); }
    catch (e) { if (!controller.signal.aborted) setError(en ? requestErrorEnglish((e as Error).message) : (e as Error).message); }
    finally { if (action.current === controller) { action.current = null; setPending(false); } }
  }

  function newConversation() {
    setActiveConversation(crypto.randomUUID()); setHistoryOpen(false); setQuestion(''); setError(''); setNotice(''); autoScroll.current = true; input.current?.focus();
  }

  function ask(value: string, mode: Mode = 'chat', regenerate?: Turn) {
    if (preview || !available || loading || action.current || value.trim().length < 1) return;
    const conversationId = activeConversation && !activeConversation.startsWith('legacy:') ? activeConversation : undefined;
    autoScroll.current = true;
    setPendingQuestion(value.trim());
    void run(async signal => {
      try {
        const data = await request('auto-assistant', { ...json('POST', { vehicleId, question: value.trim(), language, mode, localFallback: false, conversationId, contextTurns: Math.min(4, visibleTurns.length), contextIds: visibleTurns.filter(turn => turn.id !== regenerate?.id).slice(-4).map(turn => turn.id), ...(regenerate ? { excludeTurnId: regenerate.id } : {}) }), signal });
        setTurns(previous => [...previous, data.turn].slice(-150));
        setActiveConversation(conversationKey(data.turn)); setQuestion('');
      } finally { setPendingQuestion(''); }
    });
  }

  async function feedback(turn: Turn, value: 1 | -1) {
    if (preview || pending) return;
    const next = turn.feedback === value ? null : value;
    try {
      await request('auto-assistant/feedback', json('POST', { vehicleId, turnId: turn.id, feedback: next }));
      setTurns(previous => previous.map(item => item.id === turn.id ? { ...item, feedback: next } : item));
      setNotice(t('Feedback salvat. Mulțumim!', 'Feedback saved. Thank you!'));
    } catch { setError(t('Feedbackul nu a putut fi salvat. Reîncearcă.', 'Could not save feedback. Please try again.')); }
  }

  function removeConversation() {
    if (!visibleTurns.length || !window.confirm(t('Ștergi această conversație? Acțiunea nu poate fi anulată.', 'Delete this conversation? This cannot be undone.'))) return;
    const ids = visibleTurns.map(turn => turn.id);
    void run(async signal => {
      await request('auto-assistant/history', { ...json('DELETE', { vehicleId, turnIds: ids }), signal });
      setTurns(previous => previous.filter(turn => !ids.includes(turn.id))); newConversation();
    });
  }

  function extract(file: File) {
    if (!available || preview || action.current) return;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) { setError(t('Alege un PDF, JPEG sau PNG.', 'Choose a PDF, JPEG or PNG.')); return; }
    if (file.size > 2097152) { setError(t('Maximum 2 MB per fișier.', 'Maximum 2 MB per file.')); return; }
    void run(async signal => {
      const form = new FormData();
      form.set('file', file);
      form.set('vehicleId', vehicleId);
      const data = await request('auto-assistant/scan', { method: 'POST', body: form, signal });
      setToolsOpen(true);
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
    { icon: BarChart3, label: t('Analizează cheltuielile', 'Analyze my expenses'), detail: t('Costuri și economii', 'Costs and savings'), question: t('Analizează cheltuielile mașinii mele și explică unde pot reduce costurile.', 'Analyze my vehicle expenses and explain where I could save.'), mode: 'finance' as Mode },
    { icon: CalendarDays, label: t('Următoarea revizie', 'Next maintenance'), detail: t('Termene și kilometri', 'Dates and mileage'), question: t('Când trebuie să fac următoarea revizie, pe baza datelor salvate?', 'When is my next maintenance due, based on my saved records?'), mode: 'maintenance' as Mode },
    { icon: FileScan, label: t('Verifică documentele', 'Check my documents'), detail: t('Valabilitate și expirări', 'Validity and expiry dates'), question: t('Verifică documentele salvate pentru mașina mea. Ce expiră în curând?', 'Check my saved vehicle documents. What expires soon?'), mode: 'chat' as Mode },
    { icon: Wrench, label: t('O problemă tehnică', 'A technical problem'), detail: t('Înțelege simptomele', 'Understand the symptoms'), question: t('Ajută-mă să înțeleg o problemă tehnică la mașină. Ce detalii îți trebuie?', 'Help me understand a technical issue with my car. What details do you need?'), mode: 'chat' as Mode },
    { icon: History, label: t('Istoricul service', 'Service history'), detail: t('Lucrări și întreținere', 'Work and maintenance'), question: t('Analizează istoricul service salvat pentru mașina mea.', 'Analyze my saved vehicle service history.'), mode: 'analysis' as Mode },
  ];
  return (
    <div className="ac-ai-layout ac-ai-chatgpt-layout">
      <div className="ac-ai-main">
      <section className="card ac-ai-chat" aria-label={t('Conversație AutoCare AI', 'AutoCare AI conversation')}>
        <div className="ac-ai-heading">
          <div className="ac-ai-brand"><span className="ac-ai-brand-icon"><Sparkles size={21}/></span><div><h3>AutoCare <span>AI</span></h3><span className="ac-ai-online" data-available={available}><i/>{available ? t('Disponibil', 'Available') : t('Indisponibil', 'Unavailable')}</span></div></div>
          <div className="ac-ai-header-actions">
            <button type="button" className="ac-ai-history-trigger" title={t('Istoric conversații', 'Conversation history')} aria-label={t('Istoric conversații', 'Conversation history')} aria-expanded={historyOpen} onClick={() => setHistoryOpen(open => !open)}><History size={19}/></button>
            <button className="ac-ai-new-chat" type="button" aria-label={t('Conversație nouă', 'New chat')} disabled={pending || loading} onClick={newConversation}><MessageSquareText size={17}/><span>{t('Chat nou', 'New chat')}</span></button>
            <a className="ac-ai-close" href="/cont?tab=Dashboard" aria-label={t('Închide chatul', 'Close chat')}><X size={18}/></a>
            <details className="ac-ai-actions-menu"><summary aria-label={t('Opțiuni conversație', 'Conversation options')}><MoreHorizontal size={21}/></summary><div>
              <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); setToolsOpen(open => !open); }}><FileScan size={17}/>{t('Documente și rapoarte', 'Documents and reports')}</button>
              <button type="button" disabled={pending || loading || !visibleTurns.length} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); removeConversation(); }}><Trash2 size={17}/>{t('Șterge conversația', 'Delete conversation')}</button>
            </div></details>
          </div>
        </div>
        {historyOpen && <div className="ac-ai-history-overlay"><button type="button" className="ac-ai-history-backdrop" aria-label={t('Închide istoricul', 'Close history')} onClick={() => setHistoryOpen(false)}/><nav className="ac-ai-history-panel" aria-label={t('Istoricul conversațiilor', 'Conversation history')}><div className="ac-ai-history-title"><strong>{t('Conversațiile tale', 'Your conversations')}</strong><button type="button" onClick={() => setHistoryOpen(false)} aria-label={t('Închide', 'Close')}><X size={18}/></button></div><p>{t('Salvate pentru această mașină', 'Saved for this vehicle')}</p>{groups.map(group => <button type="button" className={activeConversation === group.id ? 'active' : ''} key={group.id} disabled={pending} onClick={() => { setActiveConversation(group.id); setHistoryOpen(false); setError(''); }}><MessageSquareText size={16}/><span><strong>{group.title}</strong><small>{new Date(group.updatedAt).toLocaleDateString(locale)} · {group.turns.length} {t('răspunsuri', 'replies')}</small></span></button>)}{!groups.length && <p>{t('Conversațiile vor apărea aici după primul răspuns.', 'Your conversations will appear here after the first reply.')}</p>}</nav></div>}
        {!available && <p className="ac-ai-state" role="status">{t('AI-ul nu este disponibil momentan. Încearcă mai târziu sau contactează suportul.', 'AI is currently unavailable. Try later or contact support.')}</p>}
        <div ref={messageScroll} className="ac-ai-message-scroll" role="log" aria-label={t('Mesaje', 'Messages')} aria-busy={pending || loading} onScroll={event => { const el = event.currentTarget; autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140; }}>
          {loading ? <div className="ac-ai-loading" role="status"><Sparkles size={24}/>{t('Se încarcă conversațiile…', 'Loading conversations…')}</div> : visibleTurns.length || pendingQuestion ? <ol className="ac-ai-turns" aria-live="polite">
            {visibleTurns.map((turn, index) => <li key={turn.id}>
              <div className="ac-ai-user-row"><div><p className="ac-ai-question" data-user-content>{turn.question}</p><small><time dateTime={turn.createdAt}>{new Date(turn.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time><CheckCheck size={13}/></small></div></div>
              <div className="ac-ai-bot-row"><span className="ac-ai-avatar"><Sparkles size={17}/></span><div className="ac-ai-answer"><strong className="ac-ai-assistant-name">AutoCare AI</strong><AiMarkdown text={turn.answer}/><div className="ac-ai-response-actions">
                <button type="button" title={t('Copiază răspunsul', 'Copy answer')} aria-label={t('Copiază răspunsul', 'Copy answer')} onClick={() => void navigator.clipboard.writeText(turn.answer).then(() => setNotice(t('Răspuns copiat.', 'Answer copied.'))).catch(() => setError(t('Nu s-a putut copia răspunsul.', 'Could not copy answer.')))}><Copy size={15}/></button>
                {index === visibleTurns.length - 1 && <button type="button" disabled={pending || !available} title={t('Regenerează răspunsul', 'Regenerate answer')} aria-label={t('Regenerează răspunsul', 'Regenerate answer')} onClick={() => ask(turn.question, 'chat', turn)}><RotateCcw size={15}/></button>}
                <button type="button" disabled={pending} aria-pressed={turn.feedback === 1} title={t('Răspuns util', 'Helpful answer')} aria-label={t('Răspuns util', 'Helpful answer')} onClick={() => void feedback(turn, 1)}><ThumbsUp size={15}/></button>
                <button type="button" disabled={pending} aria-pressed={turn.feedback === -1} title={t('Răspuns neutil', 'Unhelpful answer')} aria-label={t('Răspuns neutil', 'Unhelpful answer')} onClick={() => void feedback(turn, -1)}><ThumbsDown size={15}/></button>
                <time dateTime={turn.createdAt}>{new Date(turn.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time>
              </div></div></div>
            </li>)}
            {pendingQuestion && <li className="ac-ai-pending-turn"><div className="ac-ai-user-row"><div><p className="ac-ai-question">{pendingQuestion}</p></div></div><div className="ac-ai-typing" role="status"><span className="ac-ai-avatar"><Sparkles size={17}/></span><span className="ac-ai-typing-dots"><i/><i/><i/></span>{t('AutoCare AI pregătește răspunsul…', 'AutoCare AI is thinking…')}<button type="button" className="ac-ai-stop" aria-label={t('Oprește așteptarea', 'Stop waiting')} onClick={() => { action.current?.abort(); action.current = null; setPending(false); setPendingQuestion(''); setNotice(t('Așteptarea a fost oprită. Cererea poate fi finalizată de server și poate apărea în istoric.', 'Stopped waiting. The server may finish the request and save it in history.')); }}><Square size={12}/></button></div></li>}
          </ol> : <div className="ac-ai-welcome"><span className="ac-ai-welcome-icon"><Sparkles size={32}/></span><small>{t('ASISTENTUL TĂU AUTO PERSONAL', 'YOUR PERSONAL CAR ASSISTANT')}</small><h3>{t('Salut! Sunt AutoCare AI.', 'Hi! I’m AutoCare AI.')}</h3><p>{t('Cu ce te pot ajuta astăzi cu mașina ta?', 'How can I help you with your car today?')}</p><span className="ac-ai-context"><CarFront size={15}/>{vehicleName}<span>· {t('Datele mașinii selectate', 'Selected vehicle data')}</span></span><div className="ac-ai-suggestions">{suggestions.map(({ icon: Icon, ...item }) => <button key={item.label} type="button" disabled={preview || pending || !available} onClick={() => ask(item.question, item.mode)}><span className="ac-ai-suggestion-icon"><Icon size={20}/></span><span><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowUpRight size={16}/></button>)}</div></div>}
        </div>
        {visibleTurns.length > 0 && <div className="ac-ai-quick-prompts"><button type="button" onClick={() => ask(suggestions[0].question, 'finance')} disabled={pending || loading || preview || !available}><BarChart3 size={14}/>{t('Costuri', 'Costs')}</button><button type="button" onClick={() => ask(suggestions[1].question, 'maintenance')} disabled={pending || loading || preview || !available}><CalendarDays size={14}/>{t('Revizii', 'Maintenance')}</button><button type="button" onClick={() => ask(suggestions[2].question)} disabled={pending || loading || preview || !available}><FileScan size={14}/>{t('Documente', 'Documents')}</button></div>}
        {notice && <p className="ac-ai-notice" role="status">{notice}</p>}
        {error && <p className="ac-ai-inline-error" role="alert">{error}</p>}
        <form className="ac-ai-composer" onSubmit={event => { event.preventDefault(); ask(question); }}>
          <input ref={fileInput} type="file" className="ac-ai-file-input" accept="application/pdf,image/png,image/jpeg" aria-label={t('Scanează un document', 'Scan a document')} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) extract(file); }}/>
          <button className="ac-ai-attach" type="button" title={t('Scanează PDF sau imagine · maximum 2 MB', 'Scan PDF or image · maximum 2 MB')} aria-label={t('Scanează un document sau o imagine', 'Scan a document or image')} disabled={preview || pending || !available} onClick={() => fileInput.current?.click()}><Paperclip size={19}/></button>
          <textarea ref={input} aria-label={t('Întrebarea ta', 'Your question')} placeholder={t('Scrie un mesaj…', 'Write a message…')} rows={1} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(question); } }} minLength={1} maxLength={600} value={question} onChange={event => setQuestion(event.target.value)} required disabled={preview || pending || !available}/>
          <button className="ac-ai-send" type="submit" aria-label={t('Trimite mesajul', 'Send message')} disabled={preview || pending || loading || !available || !question.trim()}><ArrowUp size={21}/></button>
        </form>

        <details className="ac-ai-disclosure"><summary><ShieldCheck size={13}/>{t('Date și recomandări AI', 'AI data and advice')}<ChevronDown size={13}/></summary><p>{t('Întrebarea, istoricul recent și datele relevante ale mașinii sunt trimise furnizorului AI. Fișierele sunt folosite pentru extragerea datelor, nu ca atașamente în conversație. Recomandările nu înlocuiesc un diagnostic în service.', 'Your question, recent history and relevant vehicle data are sent to the AI provider. Files are used for data extraction, not as conversation attachments. Advice does not replace a professional inspection.')}</p></details>
      </section>
      </div>
      <button type="button" className="ac-ai-tools-toggle" aria-expanded={toolsOpen} onClick={() => setToolsOpen(open => !open)}><FileScan size={16}/>{t("Instrumente avansate și documente", "Advanced tools and documents")} <ChevronDown size={16}/></button>
      {toolsOpen && <aside className="ac-ai-tools"><div className="ac-ai-tools-heading"><strong>{t('Documente și rapoarte', 'Documents and reports')}</strong><button type="button" aria-label={t('Închide instrumentele', 'Close tools')} onClick={() => setToolsOpen(false)}><X size={20}/></button></div>
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
            <label>{t('Tip document', 'Document type')}<select value={scan.category} onChange={e => setScan({ ...scan, category: e.target.value })}>{categories.map(category => <option key={category} value={category}>{en && category === 'Rovinietă' ? 'Road vignette' : en && category === 'Talon' ? 'Registration certificate' : en && category === 'Alt document' ? 'Other document' : category}</option>)}</select></label>
            <label>{t('Număr document', 'Document number')}<input maxLength={120} value={scan.number} onChange={e => setScan({ ...scan, number: e.target.value })} /></label>
            <label>{t('Emitere', 'Issue date')}<PremiumDateInput type="date" value={scan.date} onChange={e => setScan({ ...scan, date: e.target.value })} /></label>
            <label>{t('Expirare', 'Expiry date')}<PremiumDateInput type="date" min={scan.date || undefined} required={scan.category === 'RCA'} value={scan.expiresAt} onChange={e => setScan({ ...scan, expiresAt: e.target.value })} /></label>
            <label>{t('Cost în RON', 'Cost in RON')}<input type="number" min="0" max="1000000" step=".01" value={scan.amountRon} onChange={e => setScan({ ...scan, amountRon: e.target.value })} /></label>
            <button className="primary" disabled={pending}>{t('Confirmă și salvează', 'Confirm and save')}</button>
            <button type="button" disabled={pending} onClick={() => setScan(null)}>{t('Renunță', 'Cancel')}</button>
          </form>}
        </section>
        <div aria-live="polite" className="ac-ai-feedback">{pending && <p>{t('Se procesează…', 'Processing…')}</p>}{notice && <p>{notice}</p>}{error && <p role="alert">{error}</p>}</div>
      </aside>}
    </div>
  );
}
