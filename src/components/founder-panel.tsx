'use client';
import {translateApplicationCopy} from '@/lib/application-language';
import {useApplicationLocale} from './application-locale';
import { useEffect, useState, useRef, type FormEvent } from 'react';
import {
  LayoutDashboard,
  Mail,
  Users,
  Shield,
  Star,
  Tag,
  MessageSquare,
  ScrollText,
  Settings,
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  ArrowUpRight,
} from 'lucide-react';
import SupportChat from './support-chat';
import SearchConsoleSettings from './search-console-settings';
import GoogleMailSettings from './google-mail-settings';
import MailCenter from './mail-center';
import { savings } from '@/lib/pricing-display';
import type { founderOverview, founderUsers, founderUserDetail, founderAudit } from '@/lib/founder';
type Overview = Awaited<ReturnType<typeof founderOverview>>;
type UsersData = Awaited<ReturnType<typeof founderUsers>>;
type User = UsersData['rows'][number];
type Detail = Awaited<ReturnType<typeof founderUserDetail>>;
type Audit = Awaited<ReturnType<typeof founderAudit>>;
const nav = [
  ['Overview', LayoutDashboard],
  ['Utilizatori', Users],
  ['Roluri și permisiuni', Shield],
  ['Abonamente', Star],
  ['Prețuri', Tag],
  ['Chat și suport', MessageSquare],
  ['Jurnal de audit', ScrollText],
  ['Mail Center', Mail],
  ['Setări administrative', Settings],
] as const;
const formatMoney = (b: number,locale:string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'RON' }).format(b / 100);
const labels: Record<string, string> = {
  founder: 'Fondator',
  admin: 'Administrator',
  assistant: 'Asistent',
  user: 'Client',
};
async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch('/api/v1/founder/' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const out = await r.json();
  if (!r.ok) throw new Error(out.error || 'Operațiunea nu a reușit.');
  return out;
}
function Pagination({
  page,
  total,
  size,
  change,
}: {
  page: number;
  total: number;
  size: number;
  change: (p: number) => void;
}) {
  return (
    <div className="founder-pagination">
      <span>
        {total} rezultate · Pagina {page} din {Math.max(1, Math.ceil(total / size))}
      </span>
      <div>
        <button
          aria-label="Pagina anterioară"
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          aria-label="Pagina următoare"
          disabled={page * size >= total}
          onClick={() => change(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export default function FounderPanel({ initial, name }: { initial: Overview; name: string }) {

  const locale=useApplicationLocale();
  const money=(b:number)=>formatMoney(b,locale);
const [tab, setTab] = useState('Roluri și permisiuni'),
    [overview, setOverview] = useState(initial),
    [users, setUsers] = useState<UsersData | null>(null),
    [audit, setAudit] = useState<Audit | null>(null),
    [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [query, setQuery] = useState(''),
    [role, setRole] = useState(''),
    [premiumFilter, setPremiumFilter] = useState(''),
    [selected, setSelected] = useState<User | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [duration, setDuration] = useState('1');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('gmail')) setTab('Setări administrative');
  }, []);
  const detailsRef = useRef<HTMLElement>(null);
  const userPane = ['Utilizatori', 'Roluri și permisiuni', 'Abonamente'].includes(tab);
  async function loadUsers() {
    const result: UsersData = await api(
      'users?' +
        new URLSearchParams({ page: String(page), q: query, role, premium: premiumFilter }),
    );
    setUsers(result);
    setSelected((old) => (old ? result.rows.find((u) => u.id === old.id) || old : null));
  }
  async function refresh() {
    setOverview(await api('overview'));
    if (userPane) await loadUsers();
    if (selected) setDetail(await api('users/' + selected.id));
  }
  useEffect(() => {
    setError('');
    if (userPane) void loadUsers().catch((e) => setError(e.message));
    if (tab === 'Jurnal de audit')
      void api('audit?' + new URLSearchParams({ page: String(page), q: query }))
        .then(setAudit)
        .catch((e) => setError(e.message));
  }, [tab, page, query, role, premiumFilter]);
  async function act(work: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function navigate(t: string) {
    setTab(t);
    setPage(1);
    setQ('');
    setQuery('');
    setRole('');
    setPremiumFilter('');
    setSelected(null);
    setDetail(null);
    setError('');
    setNotice('');
  }
  async function choose(user: User) {
    setSelected(user);
    setDetail(null);
    setError('');
    try {
      setDetail(await api('users/' + user.id));
      detailsRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const price = overview.pricing;
  const saving = savings(price.monthlyBani, price.annualBani);
  function search(e: FormEvent) {
    e.preventDefault();
    setQuery(q);
    setPage(1);
  }
  return (
    <div className="founder-shell">
      <aside className="founder-sidebar">
        <a href="/cont" className="founder-brand">
          <span>
            <Shield size={24} />
          </span>
          AutoCare <small>CONTROL</small>
        </a>
        <div className="founder-owner">
          <span className="founder-owner-dot" /> SPAȚIUL FONDATORULUI
        </div>
        <nav aria-label="Panou Fondator">
          {nav.map(([label, Icon]) => (
            <button
              className={tab === label ? 'active' : ''}
              key={label}
              onClick={() => navigate(label)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <a href="/cont" className="founder-back">
          <ArrowLeft size={16} /> Înapoi în garaj
        </a>
        <div className="founder-profile">
          <span>{name[0]?.toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <small>Fondator · verificat pe server</small>
          </div>
          <LockKeyhole size={15} />
        </div>
      </aside>
      <main className="founder-main">
        <header className="founder-page-header">
          <div>
            <p className="eyebrow">AUTOCARE / ADMINISTRARE</p>
            <h1>{tab}</h1>
            <p className="small muted">
              Control real asupra platformei. Acțiunile importante sunt înregistrate în audit.
            </p>
          </div>
          <span className="founder-role-badge">
            <Shield size={14} /> Fondator
          </span>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {tab === 'Overview' && (
          <>
            <div className="stats founder-stats">
              {[
                ['Total utilizatori', overview.users.total],
                ['Noi în ultimele 30 zile', overview.users.recent],
                ['Utilizatori Premium activi', overview.totalPremium],
                ['Conversații deschise', overview.conversations.open || 0],
              ].map(([label, value]) => (
                <section className="card stat" key={label}>
                  <span className="small muted">{label}</span>
                  <div className="value">{value}</div>
                </section>
              ))}
            </div>
            <section className="card founder-response">
              <h3>Suport · primul răspuns</h3>
              <strong>
                {overview.responseTime.averageSeconds === null
                  ? 'Nu există răspunsuri înregistrate'
                  : Math.ceil(overview.responseTime.averageSeconds / 60) + ' minute în medie'}
              </strong>
              <p className="micro">
                Calculat din {overview.responseTime.answered} conversații cu răspuns real al
                echipei. Mesajele automate de intrare sunt excluse.
              </p>
            </section>
            <div className="grid2">
              <section className="card">
                <p className="eyebrow">SURSA ACCESULUI</p>
                <h3>Premium plătit și manual</h3>
                <div className="founder-metric-row">
                  <span>Plătit, activ</span>
                  <strong>{overview.paidPremium}</strong>
                </div>
                <div className="founder-metric-row">
                  <span>Manual, activ</span>
                  <strong>{overview.manualPremium}</strong>
                </div>
                <p className="micro">
                  Un utilizator poate avea ambele surse. Totalul unic este {overview.totalPremium};
                  accesul manual nu reprezintă venit.
                </p>
              </section>
              <section className="card">
                <p className="eyebrow">ÎNCASĂRI CONFIRMATE</p>
                <h3>Venituri reale</h3>
                {overview.revenues.length ? (
                  overview.revenues.map((r) => (
                    <div className="founder-revenue" key={r.currency}>
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: r.currency.toUpperCase(),
                      }).format(r.total / 100)}
                    </div>
                  ))
                ) : (
                  <div className="founder-revenue">0,00 RON</div>
                )}
                <p className="micro">
                  Doar facturi live cu plată confirmată. Facturile de test și accesul manual sunt
                  excluse.
                </p>
              </section>
              <section className="card">
                <h3>Solicitări de suport</h3>
                {[
                  ['open', 'Deschise'],
                  ['completed', 'Rezolvate'],
                  ['trashed', 'În coș'],
                ].map(([key, label]) => (
                  <div key={key} className="founder-conversation-bar">
                    <div className="between">
                      <span>{label}</span>
                      <strong>{overview.conversations[key] || 0}</strong>
                    </div>
                    <progress
                      value={overview.conversations[key] || 0}
                      max={Math.max(1, ...Object.values(overview.conversations))}
                    />
                  </div>
                ))}
              </section>
              <section className="card founder-overview-note">
                <Shield size={30} />
                <h3>Un singur Fondator.</h3>
                <p className="small muted">
                  Identitatea este stabilită prin ID-ul contului din configurația serverului.
                  Rolurile din browser sau profil nu pot suprascrie această regulă.
                </p>
                <button onClick={() => navigate('Jurnal de audit')}>
                  Vezi jurnalul <ArrowUpRight size={14} />
                </button>
              </section>
            </div>
          </>
        )}
        {userPane && (
          <>
            {tab === 'Roluri și permisiuni' && (
              <section className="card founder-team-entry">
                <p className="eyebrow">ECHIPA AUTOCARE</p>
                <h2>Adaugă în echipă</h2>
                <p className="small muted">
                  Introdu e-mailul unui cont AutoCare existent și alege accesul. Pentru a retrage
                  accesul, selectează persoana și apasă „Revocă accesul”.
                </p>
                <form
                  className="founder-team-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const values = new FormData(form);
                    const email = String(values.get('email'));
                    const nextRole = String(values.get('teamRole'));
                    if (!window.confirm(translateApplicationCopy(`Acorzi rolul ${labels[nextRole]} contului ${email}?`,locale==='ro-RO'?'ro':'en')))
                      return;
                    void act(async () => {
                      await api('team', 'POST', { email, role: nextRole, confirm: true });
                      form.reset();
                      setRole('');
                      setQ(email);
                      setQuery(email);
                      setPage(1);
                    }, 'Accesul a fost acordat. Persoana poate folosi acum centrul de suport din contul său.');
                  }}
                >
                  <label>
                    E-mailul persoanei
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="off"
                      placeholder="nume@exemplu.ro"
                    />
                  </label>
                  <label>
                    Acces
                    <select name="teamRole">
                      <option value="assistant">Asistent</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    {busy ? 'Se salvează…' : 'Acordă acces'}
                  </button>
                </form>
              </section>
            )}

            <form className="founder-search" onSubmit={search}>
              <label>
                <Search size={17} />
                <input
                  aria-label="Caută utilizatori"
                  placeholder="Nume sau e-mail"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <select
                aria-label="Filtru rol"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Toate rolurile</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtru Premium"
                value={premiumFilter}
                onChange={(e) => {
                  setPremiumFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Toate abonamentele</option>
                <option value="active">Premium activ</option>
                <option value="free">Fără Premium</option>
                <option value="manual">Premium manual</option>
                <option value="paid">Premium plătit</option>
              </select>
              <button className="primary">Caută</button>
            </form>
            <div className={'founder-user-grid ' + (selected ? 'has-selection' : '')}>
              <section className="card founder-user-list">
                {users ? (
                  <>
                    <div className="founder-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Utilizator</th>
                            <th>Rol</th>
                            <th>Premium</th>
                            <th>Stare</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {users.rows.map((user) => (
                            <tr
                              key={user.id}
                              className={user.id === selected?.id ? 'selected-user' : ''}
                            >
                              <td>
                                <strong>{user.name}</strong>
                                <span className="small muted">{user.email}</span>
                              </td>
                              <td>
                                <span className={'role-badge role-' + user.role}>
                                  {labels[user.role]}
                                </span>
                              </td>
                              <td className="founder-premium-cell">
                                <span
                                  className={
                                    'pill ' +
                                    (user.premiumPaid || user.premiumManual
                                      ? 'valid'
                                      : 'premium-free')
                                  }
                                >
                                  <Star size={12} />{' '}
                                  {user.premiumPaid || user.premiumManual
                                    ? 'Premium activ'
                                    : 'Fără Premium'}
                                </span>
                                {(user.premiumPaid || user.premiumManual) && (
                                  <>
                                    <span className="small muted">
                                      {user.premiumPaid && user.premiumManual
                                        ? 'Plătit + manual'
                                        : user.premiumPaid
                                          ? 'Plătit'
                                          : 'Oferit de Fondator'}
                                    </span>
                                    <span className="micro">
                                      {user.premiumLifetime
                                        ? 'Fără expirare'
                                        : user.premiumExpiresAt
                                          ? 'Până la ' +
                                            new Date(user.premiumExpiresAt).toLocaleDateString(
                                              locale,
                                            )
                                          : ''}
                                    </span>
                                  </>
                                )}
                              </td>
                              <td>
                                <span
                                  className={'pill ' + (user.suspendedAt ? 'expired' : 'valid')}
                                >
                                  {user.suspendedAt
                                    ? 'Suspendat'
                                    : user.emailVerified
                                      ? 'Activ'
                                      : 'E-mail neconfirmat'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="small"
                                  onClick={() => void choose(user)}
                                  disabled={busy}
                                >
                                  {tab === 'Abonamente' ? 'Gestionează Premium' : 'Gestionează'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {users.rows.length === 0 && (
                      <p className="small muted">Niciun utilizator pentru filtrele selectate.</p>
                    )}
                    <Pagination
                      page={users.page}
                      total={users.total}
                      size={users.pageSize}
                      change={setPage}
                    />
                  </>
                ) : (
                  <p className="muted small">Se încarcă utilizatorii…</p>
                )}
              </section>
              {selected && (
                <section ref={detailsRef} className="card founder-user-details">
                  <div className="between">
                    <h2>{selected.name}</h2>
                    <button
                      aria-label="Închide utilizatorul"
                      className="close"
                      onClick={() => {
                        setSelected(null);
                        setDetail(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <p className="small muted">{selected.email}</p>
                  <span className={'role-badge role-' + selected.role}>
                    {labels[selected.role]}
                  </span>
                  {detail && (
                    <div className="founder-access-summary">
                      <span className={'pill ' + (detail.access.active ? 'valid' : 'premium-free')}>
                        <Star size={14} /> {detail.access.active ? 'Premium activ' : 'Fără Premium'}
                      </span>
                      <p>
                        {detail.access.active
                          ? detail.access.paid && detail.access.manual
                            ? 'Abonament plătit și acces oferit manual'
                            : detail.access.paid
                              ? 'Abonament plătit'
                              : 'Oferit de Fondator'
                          : 'Plan gratuit'}
                      </p>
                      {detail.access.active && (
                        <strong>
                          {detail.access.lifetime
                            ? 'Fără dată de expirare'
                            : detail.access.expiresAt
                              ? 'Expiră la ' +
                                new Date(detail.access.expiresAt).toLocaleDateString(locale)
                              : ''}
                        </strong>
                      )}
                      {detail.access.paid && (
                        <p className="micro">
                          Revocarea de mai jos retrage accesul oferit manual. Abonamentul plătit
                          rămâne separat.
                        </p>
                      )}
                    </div>
                  )}
                  {selected.role !== 'founder' && tab !== 'Abonamente' && (
                    <form
                      className="stack founder-action-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const next = String(f.get('role'));
                        if (
                          window.confirm(translateApplicationCopy(`Schimbi rolul lui ${selected.name} în ${labels[next]}?`,locale==='ro-RO'?'ro':'en'))
                        )
                          void act(
                            () =>
                              api('users/' + selected.id + '/role', 'POST', {
                                role: next,
                                confirm: true,
                              }),
                            'Rolul a fost actualizat.',
                          );
                      }}
                    >
                      <label>
                        Rol verificat pe server
                        <select
                          name="role"
                          defaultValue={selected.role}
                          key={selected.id + selected.role}
                        >
                          <option value="user">Client</option>
                          <option value="assistant">Asistent</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </label>
                      <button className="primary" disabled={busy}>
                        Salvează rolul
                      </button>
                      {['admin', 'assistant'].includes(selected.role) && (
                        <button
                          type="button"
                          className="danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                translateApplicationCopy(`Revoci accesul de ${labels[selected.role]} pentru ${selected.name}? Contul va rămâne Client.`,locale==='ro-RO'?'ro':'en'),
                              )
                            )
                              void act(
                                () =>
                                  api('users/' + selected.id + '/role', 'POST', {
                                    role: 'user',
                                    confirm: true,
                                  }),
                                'Accesul administrativ a fost revocat. Contul are acum rolul Client.',
                              );
                          }}
                        >
                          Revocă accesul
                        </button>
                      )}
                    </form>
                  )}
                  <form
                    className="stack founder-action-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const grant =
                        duration === 'forever'
                          ? { lifetime: true }
                          : duration === 'custom'
                            ? { expiresAt: new Date(String(f.get('expiresAt'))).toISOString() }
                            : { months: Number(duration) };
                      if (
                        duration === 'forever' &&
                        !window.confirm(translateApplicationCopy('Acorzi explicit Premium fără dată de expirare?',locale==='ro-RO'?'ro':'en'))
                      )
                        return;
                      void act(
                        () =>
                          api('users/' + selected.id + '/premium', 'POST', {
                            ...grant,
                            note: String(f.get('note')),
                          }),
                        'Accesul manual a fost actualizat. Nu s-a efectuat nicio plată.',
                      );
                    }}
                  >
                    <h3>
                      <Star size={17} /> Acordă Premium
                    </h3>
                    <p className="small muted">Oferi acces gratuit, fără să declanșezi o plată.</p>
                    <label>
                      Durată
                      <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                        <option value="1">1 lună</option>
                        <option value="3">3 luni</option>
                        <option value="6">6 luni</option>
                        <option value="12">1 an</option>
                        <option value="custom">Dată personalizată</option>
                        <option value="forever">Fără dată de expirare</option>
                      </select>
                    </label>
                    {duration === 'custom' && (
                      <label>
                        Data și ora expirării · ora dispozitivului
                        <input name="expiresAt" type="datetime-local" required />
                      </label>
                    )}
                    <label>
                      Notă internă
                      <textarea
                        name="note"
                        maxLength={4000}
                        placeholder="Motivul acordării sau prelungirii"
                      />
                    </label>
                    <p className="micro">
                      Duratele se adaugă după expirarea accesului manual curent, dacă există.
                      Accesul manual și cel plătit rămân separate.
                    </p>
                    <button className="primary" disabled={busy}>
                      {detail?.access.manual ? 'Prelungește Premium' : 'Acordă Premium'}
                    </button>
                  </form>
                  <button
                    className="danger"
                    disabled={
                      busy ||
                      !detail ||
                      !detail.grants.some(
                        (g) => !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > new Date()),
                      )
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          translateApplicationCopy('Revoci tot accesul Premium acordat manual? Abonamentul plătit, dacă există, rămâne neschimbat.',locale==='ro-RO'?'ro':'en'),
                        )
                      )
                        void act(
                          () =>
                            api('users/' + selected.id + '/premium', 'DELETE', { confirm: true }),
                          'Accesul manual a fost revocat. Plățile și abonamentele Stripe nu au fost modificate.',
                        );
                    }}
                  >
                    Revocă Premium manual
                  </button>
                  {detail ? (
                    <>
                      <h3>Istoricul accesului manual</h3>
                      {detail.grants.length ? (
                        detail.grants.map((g) => (
                          <div className="grant-history" key={g.id}>
                            <strong>
                              {g.revokedAt
                                ? 'Revocat'
                                : g.expiresAt && new Date(g.expiresAt) < new Date()
                                  ? 'Expirat'
                                  : 'Acordat'}
                            </strong>
                            <span>
                              {new Date(g.grantedAt).toLocaleDateString(locale)} →{' '}
                              {g.expiresAt
                                ? new Date(g.expiresAt).toLocaleDateString(locale)
                                : 'Fără expirare'}
                            </span>
                            {g.note && <p>{g.note}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="micro">Niciun acces manual acordat.</p>
                      )}
                      <h3>Abonament plătit</h3>
                      <p className="small muted">
                        {detail.paid
                          ? `${detail.paid.status} · ${detail.paid.periodEnd ? new Date(detail.paid.periodEnd).toLocaleDateString(locale) : 'fără termen'}`
                          : 'Niciun abonament plătit.'}
                      </p>
                      <h3>Facturi confirmate / test</h3>
                      {detail.invoices.map((i) => (
                        <p className="micro" key={i.id}>
                          {i.status} · {i.amountBani / 100} {i.currency.toUpperCase()} ·{' '}
                          {i.livemode ? 'Live' : 'Test — exclus din venituri reale'}
                        </p>
                      ))}
                    </>
                  ) : (
                    <p className="micro">Se încarcă detaliile…</p>
                  )}
                  {selected.role !== 'founder' && (
                    <button
                      className={selected.suspendedAt ? 'button' : 'danger'}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            translateApplicationCopy(selected.suspendedAt
                              ? 'Reactivezi contul?'
                              : 'Suspendarea deconectează utilizatorul și îi oprește accesul. Continui?',locale==='ro-RO'?'ro':'en'),
                          )
                        )
                          void act(
                            () =>
                              api('users/' + selected.id + '/access', 'POST', {
                                suspended: !selected.suspendedAt,
                                confirm: true,
                                reason: 'Acțiune a Fondatorului',
                              }),
                            'Accesul contului a fost actualizat.',
                          );
                      }}
                    >
                      {selected.suspendedAt ? 'Reactivează contul' : 'Suspendă contul'}
                    </button>
                  )}
                </section>
              )}
            </div>
          </>
        )}
        {tab === 'Prețuri' && (
          <section className="card founder-pricing">
            <p className="eyebrow">TARIFE ÎN RON</p>
            <h2>Prețuri clare. Sume verificate.</h2>
            <form
              key={price.version}
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  !window.confirm(
                    translateApplicationCopy('Actualizezi prețurile pentru abonamentele noi? Abonamentele existente nu vor fi modificate automat.',locale==='ro-RO'?'ro':'en'),
                  )
                )
                  return;
                void act(
                  () =>
                    api('pricing', 'POST', {
                      monthlyBani: Math.round(Number(f.get('monthly')) * 100),
                      annualBani: Math.round(Number(f.get('annual')) * 100),
                      version: price.version,
                      syncProcessor: f.has('sync'),
                      confirm: true,
                    }),
                  'Prețurile au fost salvate. Verificarea procesatorului rămâne obligatorie la checkout.',
                );
              }}
            >
              <div className="form-grid">
                <label>
                  Premium lunar · lei
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    name="monthly"
                    defaultValue={price.monthlyBani / 100}
                    required
                  />
                </label>
                <label>
                  Premium anual · lei
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    name="annual"
                    defaultValue={price.annualBani / 100}
                    required
                  />
                </label>
              </div>
              <label className="check">
                <input type="checkbox" name="sync" />
                Sincronizează și catalogul Stripe configurat
              </label>
              <p className="micro">
                Catalogul folosește prețuri noi pentru achizițiile viitoare. Nu mutăm și nu taxăm
                automat abonamentele existente. Fără sincronizare validă, checkout-ul care nu
                corespunde tarifului afișat este blocat.
              </p>
              <button className="primary" disabled={busy}>
                Salvează prețurile
              </button>
            </form>
            <div className="founder-pricing-summary">
              <p>
                12 plăți lunare: <strong>{money(saving.annualMonthlyBani)}</strong>
              </p>
              <p>
                Plată anuală: <strong>{money(price.annualBani)}</strong>
              </p>
              <p>
                Economie:{' '}
                <strong>
                  {money(saving.savingBani)} ·{' '}
                  {saving.savingPercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                </strong>
              </p>
              <p className="micro">
                Catalog curent:{' '}
                {price.monthlyPriceId && price.annualPriceId
                  ? 'ID-uri sincronizate în baza de date'
                  : 'verifică ID-urile și configurația Stripe înainte de plată'}
                .
              </p>
            </div>
          </section>
        )}
        {tab === 'Chat și suport' && <SupportChat role="founder" />}
        {tab === 'Jurnal de audit' && (
          <section className="card">
            <form className="founder-search" onSubmit={search}>
              <label>
                <Search size={16} />
                <input
                  aria-label="Caută în audit"
                  placeholder="Caută după acțiune"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <button>Caută</button>
            </form>
            {audit ? (
              <>
                <div className="founder-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Moment</th>
                        <th>Acțiune</th>
                        <th>Autor</th>
                        <th>Țintă</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString(locale)}</td>
                          <td>{row.action}</td>
                          <td>{row.actorId || 'Sistem'}</td>
                          <td>{row.target}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={audit.page}
                  total={audit.total}
                  size={audit.pageSize}
                  change={setPage}
                />
              </>
            ) : (
              <p className="small muted">Se încarcă jurnalul…</p>
            )}
          </section>
        )}
        {tab === 'Mail Center' && <MailCenter />}
        {tab === 'Setări administrative' && (
          <>
            <GoogleMailSettings />
            <SearchConsoleSettings />
            <section className="card founder-config">
              <LockKeyhole size={29} />
              <h2>Securitate și configurație</h2>
              <dl>
                <div>
                  <dt>Fondator unic</dt>
                  <dd>
                    {overview.founderConfigured
                      ? 'Configurat prin ID-ul contului pe server'
                      : 'Necesită configurare'}
                  </dd>
                </div>
                <div>
                  <dt>Roluri administrative</dt>
                  <dd>Pot fi atribuite doar din operațiuni autorizate de Fondator.</dd>
                </div>
                <div>
                  <dt>Premium manual</dt>
                  <dd>Entitlement separat, fără facturi sau plăți fictive.</dd>
                </div>
                <div>
                  <dt>Procesator de plăți</dt>
                  <dd>
                    Necesită Stripe, catalog RON și webhook-uri semnate. Prețul este verificat
                    înainte de checkout.
                  </dd>
                </div>
                <div>
                  <dt>Actualizarea configurației sensibile</dt>
                  <dd>Doar pe server. Cheile și ID-ul Fondatorului nu sunt expuse în frontend.</dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
