'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Headset,
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
  attachments?: { id: string; messageId: string; name: string }[];
  receipts?: { userId: string; lastReadAt: string }[];
};
const roles: Record<string, string> = {
  user: 'Client',
  assistant: 'Asistent',
  admin: 'Administrator',
  founder: 'Fondator',
  system: 'Sistem',
};
async function request(path: string, method = 'GET', data?: unknown) {
  const r = await fetch('/api/v1/support/chat' + path, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store',
  });
  const out = await r.json();
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
  const staff = ['assistant', 'admin', 'founder'].includes(role);
  const [status, setStatus] = useState('open'),
    [threads, setThreads] = useState<Thread[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [query, setQuery] = useState(''),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!preview),
    [mobileThread, setMobileThread] = useState(false),
    [entered, setEntered] = useState(false),
    [clock, setClock] = useState(() => Date.now()),
    [olderBusy, setOlderBusy] = useState(false);
  const [team, setTeam] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selfId, setSelfId] = useState('');
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
  statusRef.current = status;
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 10000); return () => clearInterval(timer); }, []);
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
    try {
      const out = await request('?status=' + currentStatus);
      if (currentStatus !== statusRef.current) return;
      setThreads(out.threads);
      setCounts(out.counts);
      if (staff && currentStatus === 'open') {
        const next = new Map<string, string>();
        for (const thread of out.threads as Thread[]) {
          if (thread.status !== 'open' || (thread.assignedTo && thread.assignedTo !== selfId)) continue;
          next.set(thread.id, thread.updatedAt);
          const previous = notifiedMessages.current.get(thread.id);
          if (notificationBaseline.current && (!previous || previous !== thread.updatedAt) && Number(thread.unreadCount || 0) > 0 && notificationEnabled.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const alert = new Notification(previous ? 'Mesaj nou · AutoCare' : 'Solicitare nouă · AutoCare', {
                body: thread.name + ' · ' + (thread.title || 'Conversație de suport'),
                tag: 'autocare-support-' + thread.id,
                icon: '/favicon.ico',
              });
              alert.onclick = () => { window.focus(); alert.close(); };
            } catch { /* Browserul poate refuza notificarea în fundal. */ }
          }
        }
        notifiedMessages.current = next;
        notificationBaseline.current = true;
      }
      const current =
        out.threads.find((t: Thread) => t.id === selectedRef.current) || out.threads[0];
      if (!current) {
        ++epoch.current;
        selectedRef.current = null;
        setSelected(null);
        setDetail(null);
        return;
      }
      if (current.id !== selectedRef.current) {
        setEntered(false);
        setMobileThread(false);
        await openThread(current, false);
        setMobileThread(false);
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
      if (currentStatus !== statusRef.current) void refresh();
    }
  }
  useEffect(() => {
    setError('');
    void refresh();
    if (preview) return;
    const timer = setInterval(() => {
      void refresh();
    }, 8000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(timer);
      ++epoch.current;
    };
  }, [status, preview]);
  useEffect(() => {
    if (staff && typeof Notification !== 'undefined') notificationEnabled.current = Notification.permission === 'granted';
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
      document.hidden ||
      (staff && window.innerWidth <= 760 && !mobileThread)
    )
      return;
    void request('/' + selected + '/read', 'POST', { messageId: lastId }).catch(() => {});
  }, [selected, lastId, preview, staff, mobileThread]);
  async function assign(assigneeId: string) {
    if (!selected || preview) return;
    setBusy(true);
    setError('');
    try {
      await request('/' + selected + '/assign', 'POST', { assigneeId: assigneeId || null });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!selected || preview) return;
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
    if (!text.trim() || busy || (!staff && status === 'trashed')) return;
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
      selectedRef.current = out.threadId;
      setSelected(out.threadId);
      follow.current = true;
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
  const visible = threads.filter((t) =>
    `${t.name} ${t.email} ${t.title}`
      .toLocaleLowerCase('ro')
      .includes(query.toLocaleLowerCase('ro')),
  );
  const canWrite = staff
    ? !!current && current.status === 'open' && detail?.thread.id === selected && !!selfId && current.assignedTo === selfId && entered
    : true;
  const actions = (thread: Thread) => (
    <div className="support-row-actions">
      {thread.status === 'open' && (
        <button
          disabled={busy}
          aria-label={'Finalizează conversația cu ' + thread.name}
          title="Finalizează conversația"
          onClick={(e) => {
            e.stopPropagation();
            void change(thread, 'complete');
          }}
        >
          <CheckCheck size={16} />
        </button>
      )}
      {thread.status === 'completed' && (
        <>
          <button
            disabled={busy}
            aria-label={'Redeschide conversația cu ' + thread.name}
            title="Redeschide"
            onClick={(e) => {
              e.stopPropagation();
              void change(thread, 'reopen');
            }}
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="support-trash"
            disabled={busy}
            aria-label={'Mută în coș conversația cu ' + thread.name}
            title="Mută în coșul de gunoi"
            onClick={(e) => {
              e.stopPropagation();
              void change(thread, 'trash');
            }}
          >
            <Trash2 size={16} />
          </button>
        </>
      )}
      {thread.status === 'trashed' && (
        <button
          disabled={busy}
          aria-label={'Restaurează conversația cu ' + thread.name}
          title="Restaurează"
          onClick={(e) => {
            e.stopPropagation();
            void change(thread, 'restore');
          }}
        >
          <RotateCcw size={16} />
        </button>
      )}
    </div>
  );
  return (
    <section
      className={
        'support-workspace ' +
        (staff ? 'support-team' : 'support-client') +
        (mobileThread ? ' support-mobile-thread' : '')
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
          <h2>Centru de suport</h2>
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
              placeholder="Caută după nume sau e-mail"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
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
                    <span className="support-avatar">{initials(thread.name)}</span>
                    <span>
                      <strong>
                        {thread.name}{' '}
                        {!!thread.unreadCount && (
                          <span className="pill soon">{thread.unreadCount} noi</span>
                        )}
                      </strong>
                      <small>{thread.email}</small>
                      <span className="support-preview-text">{thread.title}</span>
                    </span>
                  </button>
                  <div className="support-thread-foot">
                    <time>
                      {new Date(thread.updatedAt).toLocaleDateString('ro-RO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </time>
                    <span className="support-thread-status">{thread.assignedTo ? 'Preluată' : 'În așteptare'}</span>
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
        {!staff && (
          <nav className="support-client-folders" aria-label="Arhiva conversațiilor">
            <button type="button" aria-pressed={status !== 'trashed'} onClick={() => { setStatus('open'); setSelected(null); selectedRef.current = null; setDetail(null); }}>
              <MessageSquare size={16}/> Conversație
            </button>
            <button type="button" aria-pressed={status === 'trashed'} onClick={() => { setStatus('trashed'); setSelected(null); selectedRef.current = null; setDetail(null); }}>
              <Trash2 size={16}/> Coș de gunoi
            </button>
          </nav>
        )}
        {!staff && status !== 'trashed' && (
          <div className="support-client-intro" role="status">
            <span className="support-intro-dot" />
            <span>{current?.assignedTo
              ? 'Un asistent este disponibil în conversație.'
              : current && clock - new Date(current.createdAt).getTime() >= 60000
                ? 'Mesajul tău este în așteptare. Revenim cât mai curând.'
                : 'Bine ai venit! Suntem aici să te ajutăm.'}</span>
          </div>
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
            <h3>{staff ? current?.name || 'Conversație client' : 'Asistență AutoCare'}</h3>
            <p>
              {staff
                ? current?.email || 'Mesaje private · echipa AutoCare'
                : 'Scrie-ne și echipa noastră te va ajuta.'}
            </p>
          </div>
          {staff && current ? (
            <div className="support-header-actions">
              <span className={'pill ' + (current.status === 'open' ? 'valid' : 'archived')}>
                {current.status === 'open'
                  ? current.workingAt
                    ? 'În lucru'
                    : 'Nouă'
                  : current.status === 'completed'
                    ? 'Finalizată'
                    : 'În coș'}
              </span>
              <span className="support-header-role">{current.assignedTo ? 'Responsabil desemnat' : 'În așteptare'}</span>
            </div>
          ) : (
            <div className="support-header-actions">
              <ShieldCheck size={18} className="support-shield" />
              <span className="support-header-role">Conversație privată</span>
            </div>
          )}
        </header>
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
                    setNotice('Ai preluat conversația. Clientul este anunțat automat.');
                    await refresh();
                  } catch (e) { setError((e as Error).message); }
                  finally { setBusy(false); }
                }}><LogIn size={17}/> {current.assignedTo ? 'Intră în conversație' : 'Preia conversația'}</button>
                : <button type="button" className="support-session-exit" onClick={() => { setEntered(false); setNotice('Ai ieșit din conversație. Responsabilul rămâne atribuit.'); }}><LogOut size={17}/> Ieși din conversație</button>
              )}
              {current.status === 'open' && current.assignedTo === selfId && (
                <button type="button" className="support-session-finish" disabled={busy} onClick={() => void change(current, 'complete')}><CheckCheck size={17}/> Finalizează</button>
              )}
              {current.status === 'completed' && (
                <>
                  <button type="button" className="support-session-enter" disabled={busy} onClick={() => void change(current, 'reopen')}><RotateCcw size={17}/> Redeschide</button>
                  <button type="button" className="support-session-delete" disabled={busy} onClick={() => { if (window.confirm('Muți conversația în coș? Va putea fi restaurată.')) void change(current, 'trash'); }}><Trash2 size={17}/> Șterge</button>
                </>
              )}
              {current.status === 'trashed' && (
                <button type="button" className="support-session-enter" disabled={busy} onClick={() => void change(current, 'restore')}><RotateCcw size={17}/> Restaurează</button>
              )}
            </div>
          </div>
        )}
        {staff && current?.assignedTo && current.assignedTo !== selfId && (
          <div className="support-notice" role="status">Conversația este preluată de {team.find((person) => person.id === current.assignedTo)?.name || 'alt membru al echipei'}. O poți consulta, dar nu poți răspunde.</div>
        )}
        {staff && (
          <div className="support-notification-optin">
            <button type="button" onClick={async () => {
              if (typeof Notification === 'undefined') { setNotice('Browserul nu permite notificări desktop.'); return; }
              const permission = await Notification.requestPermission();
              notificationEnabled.current = permission === 'granted';
              setNotice(permission === 'granted' ? 'Notificările pentru mesaje noi sunt activate în acest browser.' : 'Permite notificările din setările browserului pentru a primi alerte.');
            }}>Activează notificări pentru mesaje noi</button>
          </div>
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
                  <span>{message.body}</span>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString('ro-RO', {
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
                  <p>{message.body}</p>
                  {detail.attachments
                    ?.filter((f) => f.messageId === message.id)
                    .map((f) => (
                      <a key={f.id} className="support-file" href={'/api/v1/support/files/' + f.id}>
                        {f.name} · Descarcă securizat
                      </a>
                    ))}
                  {message.authorId &&
                    detail.receipts?.some(
                      (r) =>
                        r.userId !== message.authorId &&
                        new Date(r.lastReadAt) >= new Date(message.createdAt),
                    ) && <small className="support-read-receipt">Citit</small>}
                  <time>
                    {new Date(message.createdAt).toLocaleString('ro-RO', {
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
            {!staff && current && (
              <div className="support-conversation-management">
                {current.status === 'trashed' ? (
                  <button type="button" disabled={busy || preview} onClick={() => void change(current, 'restore')}>
                    <RotateCcw size={15} /> Restaurează conversația
                  </button>
                ) : (
                  <button type="button" disabled={busy || preview} onClick={() => {
                    if (window.confirm('Muți conversația în coșul de gunoi? O poți restaura ulterior.')) void change(current, 'trash');
                  }}>
                    <Trash2 size={15} /> Mută conversația în coș
                  </button>
                )}
              </div>
            )}
            {!staff && detail?.thread.status === 'completed' && (
              <p className="support-composer-hint">
                Solicitarea anterioară a fost finalizată. Un mesaj nou deschide o conversație nouă.
              </p>
            )}
            {selected && detail?.thread.status === 'open' && (
              <label className="support-upload">
                Atașează PDF sau imagine · max. 2 MB
                <input
                  type="file"
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
            <div>
              <textarea
                aria-label="Mesaj către suport"
                placeholder={staff ? 'Scrie un răspuns clientului…' : 'Scrie mesajul tău…'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={4000}
                rows={2}
                required
              />
              <button
                className="primary"
                aria-label="Trimite mesajul"
                type="submit"
                disabled={busy || !text.trim()}
              >
                {busy ? <LoaderCircle className="support-spin" size={19} /> : <Send size={19} />}
                <span>Trimite</span>
              </button>
            </div>
            <p>
              <ShieldCheck size={12} />
              <span>Conversație privată cu echipa AutoCare</span>
              <small>{text.length}/4000</small>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
