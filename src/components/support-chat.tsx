'use client';
import { SupportCustomerPanel, SupportStatistics } from './support-operations';
import './support-center.css';
import {translateApplicationCopy} from '@/lib/application-language';
import {useApplicationLocale} from './application-locale';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import {
  Headset,
  Bell,
  BarChart3,
  MoreHorizontal,
  Paperclip,
  PanelRight,
  Search,
  Send,
  CheckCheck,
  Trash2,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  ChevronLeft,
  LogOut,
  LogIn,
  LoaderCircle,
  RefreshCw,
  UserRound,
  X,
} from 'lucide-react';
type Thread = {
  id: string;
  userId: string;
  title: string;
  status: string;
  name: string;
  email: string;
  updatedAt: string;
  createdAt: string;
  workingAt?: string | null;
  assignedTo?: string | null;
  unreadCount?: number;
  priority?: string | null;
  workflow?: string | null;
  lastMessage?: {id:string;body:string;authorId:string|null;createdAt:string}|null;
};
type Message = {
  id: string;
  body: string;
  authorName: string;
  authorRole: string;
  authorId: string | null;
  createdAt: string;
};
type Detail = {
  thread: { id: string; status: string; assignedTo?: string | null };
  messages: Message[];
  hasMore: boolean;
  typing?: boolean;
  operatorOnline?: boolean;
  rating?: number | null;
  attachments?: { id: string; messageId: string; name: string }[];
  receipts?: { userId: string; lastReadAt: string }[];
};
const roles: Record<string, string> = {
  user: 'Client',
  assistant: 'Asistent',
  admin: 'Administrator',
  founder: 'Fondator',
  superadmin: 'Super Administrator',
  system: 'Sistem',
};
async function request(path: string, method = 'GET', data?: unknown) {
  const r = await fetch('/api/v1/support/chat' + path, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store',
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || 'Conexiunea cu suportul nu a reușit.');
  return out;
}
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase();
export default function SupportChat({
  role,
  preview = false,
}: {
  role: string;
  preview?: boolean;
}) {

  const locale=useApplicationLocale();
  const en=locale==='en-GB',t=(ro:string,english:string)=>en?english:ro;
  const [view,setView]=useState<'inbox'|'statistics'>('inbox');
  const workspace=useRef<HTMLElement>(null);
  const composerInput=useRef<HTMLTextAreaElement>(null);
  const attachmentInput=useRef<HTMLInputElement>(null);
const staff = ['assistant', 'admin', 'superadmin', 'founder'].includes(role);
  const [status, setStatus] = useState('open'),
    [threads, setThreads] = useState<Thread[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [query, setQuery] = useState(''),
    [priorityFilter, setPriorityFilter] = useState(''),
    [assigneeFilter, setAssigneeFilter] = useState(''),
    [unreadOnly, setUnreadOnly] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!preview),
    [mobileThread, setMobileThread] = useState(false),
    [entered, setEntered] = useState(false),
    [olderBusy, setOlderBusy] = useState(false);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  const [team, setTeam] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selfId, setSelfId] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const queryRef = useRef('');
  const jumpTo = useRef<string | null>(null);
  const typingAt = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => setServerQuery(query.trim().slice(0, 120)), 330);
    return () => clearTimeout(timer);
  }, [query]);
  const selectedRef = useRef<string | null>(null),
    statusRef = useRef(status),
    epoch = useRef(0),
    joined = useRef(new Set<string>()),
    cache = useRef<Record<string, Message[]>>({}),
    more = useRef<Record<string, boolean>>({}),
    scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    polling = useRef(false),
    notificationBaseline = useRef(false),
    notifiedMessages = useRef(new Map<string, string>()),
    notificationEnabled = useRef(false);
  useLayoutEffect(()=>{
    const element=workspace.current;if(!element)return;let frame=0,lastHeight=-1;
    const update=()=>{frame=0;const viewport=window.visualViewport,bottom=(viewport?.height??window.innerHeight)+(viewport?.offsetTop??0);const dock=document.querySelector<HTMLElement>('.autocare-mobile-dock');const rect=dock?.getBoundingClientRect();const reserved=rect&&rect.height&&rect.top<bottom&&getComputedStyle(dock!).position==='fixed'?bottom-rect.top:0;const height=Math.max(220,bottom-Math.max(0,element.getBoundingClientRect().top)-reserved-12);if(Math.abs(lastHeight-height)<1)return;lastHeight=height;element.style.setProperty('--support-height',height+'px');element.toggleAttribute('data-compact',height<440);};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};update();window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);};
  },[view,staff]);
  useLayoutEffect(()=>{const input=composerInput.current;if(!input)return;input.style.height='auto';input.style.height=Math.min(110,input.scrollHeight)+'px';},[text,selected]);
  statusRef.current = status;
  queryRef.current = serverQuery;
  function merge(id: string, messages: Message[]) {
    const rows = Array.from(
      new Map([...(cache.current[id] || []), ...messages].map((m) => [m.id, m])).values(),
    ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    cache.current[id] = rows;
    return rows;
  }
  async function openThread(thread: Thread, announce = true) {
    const turn = ++epoch.current;
    if (selectedRef.current !== thread.id) setText('');
    setDetail(null);
    setProfileOpen(false);
    selectedRef.current = thread.id;
    setSelected(thread.id);
    setMobileThread(true);
    setError('');
    follow.current = true;
    try {
      if (announce && staff && thread.status === 'open' && entered && (!thread.assignedTo || thread.assignedTo === selfId) && !joined.current.has(thread.id)) {
        await request('/' + thread.id + '/join', 'POST');
        joined.current.add(thread.id);
      }
      const result: Detail = await request('/' + thread.id);
      if (turn !== epoch.current) return;
      if (more.current[thread.id] === undefined) more.current[thread.id] = result.hasMore;
      setDetail({
        ...result,
        messages: merge(thread.id, result.messages),
        hasMore: more.current[thread.id],
      });
    } catch (e) {
      if (turn === epoch.current) setError((e as Error).message);
    }
  }
  async function refresh() {
    if (preview || polling.current) return;
    polling.current = true;
    const currentStatus = statusRef.current;
    const currentQuery = queryRef.current;
    try {
      const out = await request('?' + new URLSearchParams({ status: currentStatus, ...(staff && currentQuery ? { q: currentQuery } : {}) }));
      if (currentStatus !== statusRef.current || currentQuery !== queryRef.current) return;
      setThreads(out.threads);
      if (out.selfId) setSelfId(out.selfId);
      setCounts(out.counts);
      if (currentStatus === 'open' && !currentQuery) {
        const next = new Map<string, string>();
        for (const thread of out.threads as Thread[]) {
          if (thread.status !== 'open' || (staff && thread.assignedTo && thread.assignedTo !== selfId)) continue;
          if (!thread.lastMessage) continue;
          next.set(thread.id, thread.lastMessage.id);
          const previous = notifiedMessages.current.get(thread.id);
          if (notificationBaseline.current && previous !== thread.lastMessage.id && thread.lastMessage.authorId !== selfId && Number(thread.unreadCount || 0) > 0) {

            if (notificationEnabled.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                const title=t('Mesaj nou · AutoCare Suport', 'New message · AutoCare Support');
                const options={body:t('Deschide centrul de suport pentru a citi mesajul.', 'Open the support center to read the message.'),tag:'autocare-support-'+thread.id,icon:'/icon-192.png',data:{url:'/cont?tab=Centru%20de%20suport'}};
                const registration='serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
                if(registration) await registration.showNotification(title,options);
                else { const alert=new Notification(title,options); alert.onclick=()=>{window.focus();void openThread(thread,false);alert.close();}; }

              } catch { /* In-app alerts remain available when desktop notifications fail. */ }
            }
          }
        }
        notifiedMessages.current=next;notificationBaseline.current=true;
      }
      const current =
        out.threads.find((t: Thread) => t.id === (jumpTo.current || selectedRef.current)) || out.threads[0];
      const jumped = current?.id && jumpTo.current === current.id;
      jumpTo.current = null;
      if (!current) {
        ++epoch.current;
        selectedRef.current = null;
        setSelected(null);
        setDetail(null);
        return;
      }
      if (current.id !== selectedRef.current) {
        setEntered(false);
        await openThread(current, false);
        if (!jumped) setMobileThread(false);
      } else {
        const turn = epoch.current;
        const result: Detail = await request('/' + current.id);
        if (turn === epoch.current) {
          if (more.current[current.id] === undefined) more.current[current.id] = result.hasMore;
          setDetail({
            ...result,
            messages: merge(current.id, result.messages),
            hasMore: more.current[current.id],
          });
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      polling.current = false;
      if (currentStatus !== statusRef.current || currentQuery !== queryRef.current) void refresh();
    }
  }
  useEffect(() => {
    setError('');
    void refresh();
    if (preview) return;
    const timer = setInterval(() => {
      if (!document.hidden && navigator.onLine) void refresh();
    }, 4000);
    const onFocus = () => { if (!document.hidden && navigator.onLine) void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(timer);
      ++epoch.current;
    };
  }, [status, preview, serverQuery, selfId]);
  useEffect(() => {
    if (typeof Notification !== 'undefined') notificationEnabled.current = Notification.permission === 'granted';
  }, [staff]);
  useEffect(() => {
    if (!staff || preview) return;
    void fetch('/api/v1/support/team')
      .then(async (r) => {
        if (r.ok) { const result = await r.json(); setTeam(result.team); setSelfId(result.selfId); }
      })
      .catch(() => {});
  }, [staff, preview]);
  const lastId = detail?.messages.at(-1)?.id;
  useEffect(() => {
    if (
      preview ||
      !selected ||
      !lastId ||
      view === 'statistics' ||
      document.hidden ||
      (staff && (!entered || (window.innerWidth <= 760 && !mobileThread)))
    )
      return;
    void request('/' + selected + '/read', 'POST', { messageId: lastId }).catch(() => {});
  }, [selected, lastId, preview, staff, mobileThread, view, entered]);
  async function assign(assigneeId: string) {
    if (!selected || preview) return;
    setBusy(true);
    setError('');
    try {
      await request('/' + selected + '/assign', 'POST', { assigneeId: assigneeId || null });
      setEntered(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!selected || preview) return;
    if (busy) return;
    if (!['application/pdf','image/png','image/jpeg'].includes(file.type)) { setError(t('Alege un PDF, JPEG sau PNG.', 'Choose a PDF, JPEG or PNG.')); return; }
    if (file.size > 2097152) {
      setError('Fișierul poate avea maximum 2 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      const r = await fetch('/api/v1/support/chat/' + selected + '/files', {
        method: 'POST',
        body: form,
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Încărcarea a eșuat.');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [lastId, selected]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy || (staff && !canWrite) || (!staff && status === 'trashed')) return;
    if (preview) {
      setNotice('Previzualizare de design: mesajele nu sunt trimise.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const out = await request('', 'POST', {
        message: text.trim(),
        ...(selected && detail?.thread.status === 'open' ? { conversationId: selected } : {}),
      });
      setText('');
      if (selected) void request('/' + selected + '/typing', 'POST', { typing: false }).catch(() => {});
      typingAt.current = 0;
      selectedRef.current = out.threadId;
      setSelected(out.threadId);
      follow.current = true;
      if (out.message) {
        const messages = merge(out.threadId, [out.message]);
        setDetail(previous => previous && previous.thread.id === out.threadId ? { ...previous, messages }
          : { thread: { id: out.threadId, status: 'open' }, messages, hasMore: false });
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(thread: Thread, action: string) {
    if (preview) {
      setNotice('Previzualizare: conversațiile nu sunt modificate.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request('/' + thread.id, 'PATCH', { action });
      if (action === 'trash' || action === 'restore') setEntered(false);
      setNotice(
        action === 'trash'
          ? 'Conversația a fost mutată în coș. O poți restaura.'
          : action === 'complete'
            ? 'Conversația a fost finalizată.'
            : action === 'restore'
              ? 'Conversația a fost restaurată.'
              : 'Conversația a fost redeschisă.',
      );
      delete more.current[thread.id];
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadOlder() {
    if (!selected || !detail?.messages.length) return;
    setOlderBusy(true);
    try {
      const result: Detail = await request(
        '/' + selected + '?cursor=' + encodeURIComponent(detail.messages[0].id),
      );
      more.current[selected] = result.hasMore;
      follow.current = false;
      setDetail({ ...result, messages: merge(selected, result.messages) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOlderBusy(false);
    }
  }
  const current = threads.find((t) => t.id === selected);
  const visible = threads.filter(thread =>
    (!unreadOnly || !!thread.unreadCount) &&
    (!priorityFilter || (thread.priority ?? 'normal') === priorityFilter) &&
    (!assigneeFilter || (assigneeFilter === 'mine' ? !!selfId && thread.assignedTo === selfId : !thread.assignedTo)),
  );
  const canWrite = staff
    ? !!current && current.status === 'open' && detail?.thread.id === selected && !!selfId && current.assignedTo === selfId && entered
    : true;
  useEffect(() => {
    if (!staff || !canWrite || !selected || preview) return;
    const ping = () => {
      if (!document.hidden && navigator.onLine) void request('/' + selected + '/typing', 'POST', {}).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 20000);
    return () => clearInterval(timer);
  }, [staff, canWrite, selected, preview]);
  function updateText(value: string) {
    setText(value);
    if (!selected || preview || detail?.thread.status !== 'open' || !canWrite) return;
    const now = Date.now();
    if (value.trim() && now - typingAt.current < 3500) return;
    if (!value.trim() && !typingAt.current) return;
    typingAt.current = value.trim() ? now : 0;
    void request('/' + selected + '/typing', 'POST', { typing: !!value.trim() }).catch(() => {});
  }
  async function rateConversation(rating: number) {
    if (!selected || busy || preview) return;
    setBusy(true); setError('');
    try {
      const result = await request('/' + selected + '/rating', 'POST', { rating });
      setDetail(previous => previous?.thread.id === selected ? { ...previous, rating: result.rating } : previous);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  if (view==='statistics' && staff) return <section id="autocare-support" ref={workspace} className="support-workspace ac-support-center support-statistics-mode"><SupportStatistics preview={preview} onClose={()=>setView('inbox')}/></section>;
  return (
    <section id="autocare-support" ref={workspace}
      className={
        'support-workspace ac-support-center ' +
        (staff ? 'support-team' : 'support-client') +
        (mobileThread ? ' support-mobile-thread' : '') +
        (profileOpen && staff && current ? ' ac-support-with-profile' : '')
      }
    >
      {staff && (
        <aside className="support-sidebar">
          <div className="support-brandline">
            <span className="list-icon">
              <Headset size={21} />
            </span>
            <span>AUTOCARE · ECHIPA</span>
          </div>
          <h2>{t('Centru de suport','Support center')}</h2>
          <p className="support-sync">
            <span />
            {loading ? 'Se conectează…' : 'Mesaje private'}
          </p>
          <div className="support-filters">
            {[
              ['open', 'Active'],
              ['completed', 'Finalizate'],
              ['trashed', 'Coș de gunoi'],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={status === key}
                onClick={() => {
                  selectedRef.current = null;
                  setSelected(null);
                  setDetail(null);
                  setStatus(key);
                }}
              >
                {label} <span>{counts[key] || 0}</span>
              </button>
            ))}
          </div>
          <label className="support-search">
            <Search size={16} />
            <input
              aria-label="Caută conversații"
              placeholder="Nume, e-mail sau mesaj…"
              value={query}
              maxLength={120}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="support-inbox-tools">
            <label><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} /> Doar necitite</label>
            <details><summary><MoreHorizontal size={16}/>{t('Filtre','Filters')}</summary>
              <label>Prioritate<select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}>
                <option value="">Toate</option><option value="normal">Normală</option><option value="high">Ridicată</option><option value="urgent">Urgentă</option>
              </select></label>
              <label>Responsabil<select value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)}>
                <option value="">Toți</option><option value="mine">Atribuite mie</option><option value="unassigned">Neatribuite</option>
              </select></label>
            </details>
            <button type="button" className="support-stats-trigger" onClick={()=>setView('statistics')}><BarChart3 size={15}/>{t('Statistici','Statistics')}</button>
          </div>
          <div className="support-thread-list">
            {loading ? (
              <p className="support-placeholder">Se încarcă conversațiile…</p>
            ) : !visible.length ? (
              <p className="support-placeholder">Nicio conversație găsită.</p>
            ) : (
              visible.map((thread) => (
                <article
                  className={'support-thread ' + (selected === thread.id ? 'selected' : '')}
                  key={thread.id}
                >
                  <button className="support-thread-select" onClick={() => { setEntered(false); void openThread(thread, false); }}>
                    <span data-user-content className="support-avatar">{initials(thread.name)}</span>
                    <span>
                      <strong data-user-content>
                        {thread.name}{' '}
                        {!!thread.unreadCount && (
                          <span className="pill soon">{thread.unreadCount} noi</span>
                        )}
                      </strong>
                      <small>{thread.email}</small>
                      <span data-user-content className="support-preview-text">{thread.lastMessage?.body || thread.title}</span>
                    </span>
                  </button>
                  <div className="support-thread-foot">
                    <time dateTime={thread.lastMessage?.createdAt || thread.updatedAt}>
                      {new Date(thread.lastMessage?.createdAt || thread.updatedAt).toLocaleString(locale, {
                        day: 'numeric',
                        month: 'short', hour:'2-digit', minute:'2-digit',
                      })}
                    </time>
                    <span className="support-thread-status">{thread.priority === 'urgent' ? 'Urgentă · ' : thread.priority === 'high' ? 'Prioritară · ' : ''}{thread.status !== 'open' ? (thread.status === 'completed' ? 'Finalizată' : 'În coș') : thread.workflow === 'waiting' ? 'În așteptare' : thread.assignedTo ? 'În lucru' : 'Nouă'}</span>
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="support-sidebar-foot">
            <ShieldCheck size={15} />
            <span>Coșul păstrează conversațiile recuperabile.</span>
          </div>
        </aside>
      )}
      <div className="support-chat-panel">
        {!staff && threads.length > 1 && (
          <label className="support-own-history">Istoric conversații
            <select value={selected ?? ''} onChange={event => {
              const thread = threads.find(item => item.id === event.target.value);
              if (thread) void openThread(thread, false);
            }}>
              {threads.map(thread => <option key={thread.id} value={thread.id}>{new Date(thread.createdAt).toLocaleDateString(locale)} · {thread.title}</option>)}
            </select>
          </label>
        )}
        <header className="support-chat-header">
          {staff && (
            <button
              className="support-back"
              aria-label="Înapoi la conversații"
              onClick={() => setMobileThread(false)}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <span className="support-avatar strong">
            {staff ? <UserRound size={22} /> : <Headset size={24} />}
          </span>
          <div className="support-header-title">
            <h3>{staff ? current?.name || 'Conversație client' : t('Asistență AutoCare','AutoCare Support')}</h3>
            <p>
              {staff
                ? current?.email || 'Mesaje private · echipa AutoCare'
                : detail?.operatorOnline ? t('Echipa este online', 'The team is online') : t('Mesaje private cu echipa noastră', 'Private messages with our team')}
            </p>
          </div>
          {staff && current ? (
            <div className="support-header-actions">
              <span className={'pill ' + (current.status === 'open' ? 'valid' : 'archived')}>
                {current.status === 'open'
                  ? current.workflow === 'waiting' ? 'În așteptare' : current.workingAt
                    ? 'În lucru'
                    : 'Nouă'
                  : current.status === 'completed'
                    ? 'Finalizată'
                    : 'În coș'}
              </span>
              <button type="button" aria-expanded={profileOpen} aria-controls="support-customer-panel" disabled={preview} onClick={() => setProfileOpen(open => !open)}><PanelRight size={17} /> {t('Profil','Profile')}</button>
            </div>
          ) : (
            <div className="support-header-actions">
              <ShieldCheck size={18} className="support-shield" />
              <span className="support-header-role">Conversație privată</span>
            </div>
          )}
          <details className="support-conversation-menu"><summary aria-label={t('Opțiuni conversație','Conversation options')}><MoreHorizontal size={21}/></summary><div className="support-conversation-menu-content">        {!staff && (
          <nav className="support-client-folders" aria-label="Arhiva conversațiilor">
            <button type="button" aria-pressed={status !== 'trashed'} onClick={() => { setStatus('open'); setSelected(null); selectedRef.current = null; setDetail(null); }}>
              <MessageSquare size={16}/> Conversație
            </button>
            <button type="button" aria-pressed={status === 'trashed'} onClick={() => { setStatus('trashed'); setSelected(null); selectedRef.current = null; setDetail(null); }}>
              <Trash2 size={16}/> Coș de gunoi
            </button>
          </nav>
        )}
        {staff && current && (
          <div className="support-session-bar">
            <div className="support-session-status">
              <strong>{current.status === 'open' ? current.assignedTo ? 'Conversație preluată' : 'Solicitare nouă' : current.status === 'completed' ? 'Conversație finalizată' : 'Conversație în coș'}</strong>
              <span>{current.assignedTo ? 'Responsabil: ' + (team.find((person) => person.id === current.assignedTo)?.name || 'membru al echipei') : 'Niciun membru nu a preluat încă solicitarea.'}</span>
            </div>
            <div className="support-session-actions">
              {current.status === 'open' && (!current.assignedTo || current.assignedTo === selfId) && (!entered ?
                <button type="button" className="support-session-enter" disabled={busy || preview || !selfId} onClick={async () => {
                  setBusy(true); setError('');
                  try {
                    await request('/' + current.id + '/join', 'POST');
                    joined.current.add(current.id);
                    setEntered(true);

                    await refresh();
                  } catch (e) { setError((e as Error).message); }
                  finally { setBusy(false); }
                }}><LogIn size={17}/> {current.assignedTo ? 'Intră în conversație' : 'Preia conversația'}</button>
                : <button type="button" className="support-session-exit" onClick={() => { setEntered(false); setNotice('Ai ieșit din conversație. Responsabilul rămâne atribuit.'); }}><LogOut size={17}/> Ieși din conversație</button>
              )}
              {current.status === 'open' && (role !== 'assistant' || !current.assignedTo || current.assignedTo === selfId) && (
                <button type="button" className="support-session-finish" disabled={busy} onClick={() => void change(current, 'complete')}><CheckCheck size={17}/> Finalizează</button>
              )}
              {current.status === 'open' && (role !== 'assistant' || !current.assignedTo || current.assignedTo === selfId) && <button type="button" className="support-session-delete" disabled={busy || preview} onClick={() => { if (window.confirm(t('Ștergi conversația? Aceasta se închide și se mută în coș, de unde poate fi restaurată.', 'Delete this conversation? It will be closed and moved to trash, where it can be restored.'))) void change(current, 'trash'); }}><Trash2 size={17}/>{t('Șterge','Delete')}</button>}
              {current.status === 'completed' && (
                <>
                  <button type="button" className="support-session-enter" disabled={busy} onClick={() => void change(current, 'reopen')}><RotateCcw size={17}/> Redeschide</button>
                  <button type="button" className="support-session-delete" disabled={busy} onClick={() => { if (window.confirm(translateApplicationCopy('Muți conversația în coș? Va putea fi restaurată.',locale==='ro-RO'?'ro':'en'))) void change(current, 'trash'); }}><Trash2 size={17}/> Șterge</button>
                </>
              )}
              {current.status === 'trashed' && (
                <button type="button" className="support-session-enter" disabled={busy} onClick={() => void change(current, 'restore')}><RotateCcw size={17}/> Restaurează</button>
              )}
            </div>
          </div>
        )}
        {!staff && current && (
          <div className="support-session-bar support-client-session">
            <div className="support-session-status">
              <strong>{current.status === 'open' ? t('Conversație activă', 'Active conversation') : current.status === 'completed' ? t('Conversație încheiată', 'Conversation ended') : t('Conversație în coș', 'Conversation in trash')}</strong>
              <span>{current.status === 'open' ? t('Tu decizi când închei conversația.', 'You choose when to end the conversation.') : t('Istoricul rămâne disponibil aici.', 'Your history remains available here.')}</span>
            </div>
            <div className="support-session-actions">
              {current.status === 'open' && <button type="button" className="support-session-finish" disabled={busy || preview} onClick={() => { if (window.confirm(t('Închei conversația? Mesajele rămân în istoric.', 'End this conversation? Messages stay in your history.'))) void change(current, 'complete'); }}><CheckCheck size={17}/>{t('Încheie', 'End chat')}</button>}
              {current.status !== 'trashed' && <button type="button" className="support-session-delete" disabled={busy || preview} onClick={() => { if (window.confirm(t('Ștergi conversația? Aceasta se închide și se mută în coș, de unde poate fi restaurată.', 'Delete this conversation? It will be closed and moved to trash, where it can be restored.'))) void change(current, 'trash'); }}><Trash2 size={17}/>{t('Șterge', 'Delete')}</button>}
              {current.status === 'trashed' && <button type="button" className="support-session-enter" disabled={busy || preview} onClick={() => void change(current, 'restore')}><RotateCcw size={17}/>{t('Restaurează', 'Restore')}</button>}
            </div>
          </div>
        )}
        {
          <div className="support-notification-optin">
            <button type="button" onClick={async () => {
              if (typeof Notification === 'undefined') { setNotice('Browserul nu permite notificări desktop.'); return; }
              let permission: NotificationPermission;
              try { permission = await Notification.requestPermission(); } catch { setNotice(t('Verifică permisiunile pentru notificări ale dispozitivului.', 'Check your device notification permissions.')); return; }
              notificationEnabled.current = permission === 'granted';
              setNotice(permission === 'granted' ? 'Notificările pentru mesaje noi sunt activate în acest browser.' : 'Permite notificările din setările browserului pentru a primi alerte.');
            }}><Bell size={14}/>{t('Notificări pentru mesaje noi','New message notifications')}</button>
          </div>
        }
</div></details>
        </header>
        {staff && current?.assignedTo && current.assignedTo !== selfId && (
          <div className="support-notice" role="status">Conversația este preluată de {team.find((person) => person.id === current.assignedTo)?.name || 'alt membru al echipei'}. O poți consulta, dar nu poți răspunde.</div>
        )}
        {error && (
          <div role="alert" className="support-error">
            {error}
            <button onClick={() => void refresh()} aria-label="Reîncearcă încărcarea">
              <RefreshCw size={15} />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="support-notice">
            {notice}
            <button aria-label="Închide mesajul" onClick={() => setNotice('')}>
              <X size={14} />
            </button>
          </div>
        )}
        <div
          className="support-messages"
          ref={scroll}
          onScroll={() => {
            const el = scroll.current;
            if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          role="log"
          aria-label="Mesajele conversației"
          aria-live="polite"
        >
          {detail?.hasMore && (
            <button className="support-older" disabled={olderBusy} onClick={() => void loadOlder()}>
              {olderBusy ? 'Se încarcă…' : 'Încarcă mesaje anterioare'}
            </button>
          )}
          {detail?.messages.length ? (
            detail.messages.map((message) =>
              message.authorRole === 'system' ? (
                <div className="support-system-message" key={message.id}>
                  <ShieldCheck size={14} />
                  <span data-user-content>{message.body}</span>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              ) : (
                <article
                  className={
                    'support-message ' +
                    (message.authorRole === 'user' ? 'from-client' : 'from-team')
                  }
                  key={message.id}
                >
                  <div className="support-message-meta">
                    <strong>{message.authorName}</strong>
                    <span className={'support-rank rank-' + message.authorRole}>
                      {roles[message.authorRole] || 'Client'}
                    </span>
                  </div>
                  <p data-user-content>{message.body}</p>
                  {detail.attachments
                    ?.filter((f) => f.messageId === message.id)
                    .map((f) => (
                      <div key={f.id} className="support-file">
                        <a href={'/api/v1/support/files/' + f.id + '?view=1'} target="_blank" rel="noopener noreferrer">{f.name} · Previzualizează</a>
                        <a href={'/api/v1/support/files/' + f.id}>Descarcă</a>
                      </div>
                    ))}
                  {message.authorId &&
                    detail.receipts?.some(
                      (r) =>
                        r.userId !== message.authorId &&
                        (message.authorRole === 'user' ? r.userId === current?.assignedTo : r.userId === current?.userId) &&
                        new Date(r.lastReadAt) >= new Date(message.createdAt),
                    ) && <small className="support-read-receipt"><CheckCheck size={12}/>{t('Citit','Read')}</small>}
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString(locale, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </article>
              ),
            )
          ) : (
            <div className="support-empty">
              <div>
                <MessageSquare size={31} strokeWidth={1.3} />
              </div>
              <h3>{staff ? 'Nu există mesaje de afișat' : 'Cu ce te putem ajuta?'}</h3>
              <p>
                {staff
                  ? 'Când un client scrie, conversația apare aici.'
                  : 'Trimite primul mesaj. Răspunsurile echipei vor apărea în această conversație.'}
              </p>
            </div>
          )}
        </div>
        {detail?.typing && <p className="support-typing-label" role="status">{staff ? 'Clientul scrie…' : 'Operatorul scrie…'}</p>}
        {!staff && current?.status === 'completed' && (
          <section className="support-rating" aria-label="Evaluează conversația">
            <strong>{detail?.rating ? 'Evaluarea ta: ' + detail.rating + '/5' : 'Cum a fost experiența cu suportul?'}</strong>
            <div>{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} aria-pressed={detail?.rating === value} disabled={busy || preview} onClick={() => void rateConversation(value)}>{value}</button>)}</div>
          </section>
        )}
        {(staff && !canWrite) || (!staff && status === 'trashed') ? (
          <footer className="support-readonly">
            <ShieldCheck size={16} />
            <span>
              {!current
                ? 'Selectează o conversație activă pentru a răspunde.'
                : current.status === 'trashed'
                  ? 'Conversația este în coș. Restaureaz-o pentru a o administra.'
                  : 'Conversație finalizată. O poți redeschide din acțiuni.'}
            </span>
          </footer>
        ) : (
          <form className="support-composer" onSubmit={send}>
            {!staff && detail?.thread.status === 'completed' && (
              <p className="support-composer-hint">
                Solicitarea anterioară a fost finalizată. Un mesaj nou deschide o conversație nouă.
              </p>
            )}
            {selected && detail?.thread.status === 'open' && (
              <label className="support-upload">
                <span className="support-upload-trigger" title={t('Atașează PDF sau imagine · max. 2 MB','Attach PDF or image · max. 2 MB')}><Paperclip size={18} /><span>{t('Atașează','Attach')}</span></span>
                <input
                  ref={attachmentInput} type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  disabled={busy || preview}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {staff && <details className="support-quick-reply-menu"><summary>{t('Răspuns rapid','Quick reply')}</summary><label className="support-quick-reply"><span className="sr-only">Răspuns rapid</span>
              <select value="" onChange={event => { if (event.target.value) setText(previous => previous ? previous + '\n' + event.target.value : event.target.value); }}>
                <option value="">Alege un răspuns</option>
                <option value="Bună ziua! Îți mulțumim pentru mesaj. Cum te putem ajuta?">Salut și preluare</option>
                <option value="Ne poți spune în ce secțiune apare problema și ce mesaj vezi pe ecran?">Cere detalii</option>
                <option value="Dacă mai ai nevoie de ajutor, scrie-ne aici. Îți mulțumim!">Încheiere</option>
              </select>
            </label></details>}
            <div>
              <textarea ref={composerInput}
                disabled={busy || preview}
                aria-label="Mesaj către suport"
                placeholder={staff ? t('Scrie un răspuns clientului…','Write a reply…') : t('Scrie mesajul tău…','Write your message…')}
                value={text}
                onChange={e => updateText(e.target.value)}
                onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                maxLength={4000}
                rows={2}
                required
              />
              <button
                className="primary"
                aria-label="Trimite mesajul"
                type="submit"
                disabled={busy || preview || !text.trim()}
              >
                {busy ? <LoaderCircle className="support-spin" size={19} /> : <Send size={19} />}
                <span>{t('Trimite','Send')}</span>
              </button>
            </div>
            <p>
              <ShieldCheck size={12} />
              <span>Conversație privată cu echipa AutoCare</span>
              <small>{text.length}/4000 · {t('Enter trimite', 'Enter to send')}</small>
            </p>
          </form>
        )}
      </div>
      {staff && profileOpen && current && !preview && <button type="button" className="support-profile-backdrop" aria-label={t('Închide profilul','Close profile')} onClick={()=>setProfileOpen(false)}/> }
      {staff && profileOpen && current && !preview && <SupportCustomerPanel
        key={current.id} id={current.id} locale={locale} editable={!!selfId && current.assignedTo === selfId && current.status === 'open'}
        assignedName={team.find(person => person.id === current.assignedTo)?.name ?? (current.assignedTo ? 'Membru al echipei' : 'Neatribuit')}
        transfer={role !== 'assistant' && selfId && current.status === 'open' && (!current.assignedTo || current.assignedTo === selfId) ? { value: current.assignedTo ?? '', team, onAssign: assign } : undefined}
        onChange={refresh} onClose={() => setProfileOpen(false)} openHistory={(id, nextStatus) => {
          jumpTo.current = id;
          setQuery(''); setUnreadOnly(false); setAssigneeFilter(''); setPriorityFilter('');
          if (nextStatus !== status) setStatus(nextStatus);
          else void refresh();
        }}
      />}
    </section>
  );
}
