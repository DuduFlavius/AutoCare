'use client';
import { useEffect, useState } from 'react';
import { Mail, Eye, Send, Plus, RefreshCw } from 'lucide-react';
import type { mailCenterOverview, campaignDetail } from '@/lib/mail-center';
import type { EmailTemplate, EmailContent } from '@/lib/email-templates';
type Overview = Awaited<ReturnType<typeof mailCenterOverview>>;
type Detail = Awaited<ReturnType<typeof campaignDetail>>;
async function api(path = '', method = 'GET', body?: unknown) {
  const r = await fetch('/api/v1/founder/mail' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const out = await r.json();
  if (!r.ok) throw new Error(out.error || 'Operațiunea nu a reușit.');
  return out;
}
const labels: Record<string, string> = {
  draft: 'Ciornă',
  pending: 'În așteptare',
  held: 'Automatizare oprită',
  sending: 'În curs',
  accepted: 'Acceptat de Gmail',
  delivered: 'Livrat',
  failed: 'Eșuat',
  unknown: 'Rezultat incert — verifică Gmail',
  suppressed: 'Omis: preferințe / eveniment schimbat',
  completed: 'Procesat',
};
export default function MailCenter() {
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [data, setData] = useState<Overview | null>(null),
    [template, setTemplate] = useState<EmailTemplate>('administrative');
  const [subject, setSubject] = useState(''),
    [message, setMessage] = useState(''),
    [ctaLabel, setCtaLabel] = useState(''),
    [ctaPath, setCtaPath] = useState('/cont');
  const [category, setCategory] = useState<'transactional' | 'promotional'>('transactional'),
    [recipients, setRecipients] = useState<string[]>([]);
  const [preview, setPreview] = useState<EmailContent | null>(null),
    [width, setWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [draftId, setDraftId] = useState(''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    void api()
      .then((d: Overview) => {
        if (!active) return;
        setData(d);
        const t = d.templates.administrative;
        setSubject(t.subject);
        setMessage(t.body);
        setCtaLabel(t.cta);
        setCtaPath(t.path);
        setDraftId(crypto.randomUUID());
      })
      .catch(() => {
        if (active) setError('Mail Center nu a putut fi încărcat.');
      });
    return () => {
      active = false;
    };
  }, []);
  function choose(id: EmailTemplate) {
    if (!data) return;
    const t = data.templates[id];
    setTemplate(id);
    setSubject(t.subject);
    setMessage(t.body);
    setCtaLabel(t.cta);
    setCtaPath(t.path);
    setCategory(id === 'promotional' ? 'promotional' : 'transactional');
    setPreview(null);
    setSaved(false);
    setDraftId(crypto.randomUUID());
    setConfirmed(false);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const security = ['verification', 'password_reset', 'gmail_test'].includes(template);
  const selectedName = data?.users.find((u) => u.id === recipients[0])?.name || 'prietene';
  const eligible = (u: Overview['users'][number]) =>
    u.emailVerified &&
    u.emailEnabled !== false &&
    (category === 'promotional' ? u.promotional === true : u.transactional !== false);
  if (!data)
    return (
      <section className="card">
        <h2>Mail Center Premium</h2>
        <p role="status">{error || 'Se încarcă…'}</p>
      </section>
    );
  return (
    <div className="mail-center">
      <section className="card">
        <div className="inline">
          <Mail size={28} />
          <div>
            <p className="eyebrow">COMUNICARE AUTOCARE</p>
            <h2>Mail Center Premium</h2>
          </div>
        </div>
        <p>
          Redactează, verifică și trimite manual. Fiecare destinatar primește un email separat,
          personalizat.
        </p>
        <p className="notice">
          Automatizări: {data.automation.enabled ? 'activate' : 'dezactivate'}. Activarea necesită
          testare completă, aprobarea explicită a Fondatorului și configurare separată pe server.
        </p>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="mail-center-grid">
        <section className="card stack">
          <div className="inline">
            <h2>Redactare</h2>
            <button
              disabled={busy}
              onClick={() => {
                choose('administrative');
                setRecipients([]);
                setDetail(null);
              }}
            >
              <Plus size={15} />
              Ciornă nouă
            </button>
          </div>
          <label>
            Șablon
            <select
              value={template}
              disabled={saved || busy}
              onChange={(e) => choose(e.target.value as EmailTemplate)}
            >
              {Object.entries(data.templates).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tip de comunicare
            <select
              value={category}
              disabled={saved || busy || template === 'promotional'}
              onChange={(e) => {
                setCategory(e.target.value as typeof category);
                setPreview(null);
              }}
            >
              <option value="transactional">Tranzacțional / administrativ necesar</option>
              <option value="promotional">Promoțional — doar cu acord</option>
            </select>
          </label>
          <p className="small muted">
            Ofertele și comunicările de marketing trebuie marcate promoționale. Oamenii fără acord
            sunt excluși. Preferințele se verifică din nou înaintea trimiterii.
          </p>
          <label>
            Subiect
            <input
              maxLength={180}
              value={subject}
              disabled={saved || busy}
              onChange={(e) => {
                setSubject(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label>
            Mesaj
            <textarea
              rows={8}
              maxLength={8000}
              value={message}
              disabled={saved || busy}
              onChange={(e) => {
                setMessage(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label>
            Text buton CTA
            <input
              maxLength={60}
              value={ctaLabel}
              disabled={saved || busy}
              onChange={(e) => {
                setCtaLabel(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label>
            Destinație CTA în AutoCare
            <input
              value={ctaPath}
              placeholder="/cont?tab=Abonament"
              disabled={saved || busy}
              onChange={(e) => {
                setCtaPath(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          {security && (
            <p className="notice">
              Previzualizare de design. Verificarea și resetarea se trimit numai din fluxurile
              securizate, cu linkuri generate de autentificare. Testul Gmail se trimite din
              Conectare Gmail.
            </p>
          )}
          <label>
            Caută destinatari
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="mail-recipients" role="group" aria-label="Destinatari">
            <p>
              {recipients.length}/50 selectați ·{' '}
              {category === 'promotional'
                ? 'numai acord promoțional explicit'
                : 'preferințe tranzacționale respectate'}
            </p>
            {data.users
              .filter((u) => (u.name + ' ' + u.email).toLowerCase().includes(search.toLowerCase()))
              .map((u) => (
                <label className="check" key={u.id}>
                  <input
                    type="checkbox"
                    disabled={
                      saved ||
                      busy ||
                      !eligible(u) ||
                      (!recipients.includes(u.id) && recipients.length >= 50)
                    }
                    checked={recipients.includes(u.id)}
                    onChange={(e) => {
                      setRecipients((old) =>
                        e.target.checked ? [...old, u.id] : old.filter((id) => id !== u.id),
                      );
                      setPreview(null);
                    }}
                  />
                  <span>
                    {u.name}
                    <br />
                    <small>
                      {u.email}
                      {!eligible(u) ? ' · indisponibil pentru această categorie' : ''}
                    </small>
                  </span>
                </label>
              ))}
          </div>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () =>
                setPreview(
                  await api('/preview', 'POST', {
                    template,
                    subject,
                    message,
                    ctaLabel,
                    ctaPath,
                    name: selectedName,
                    promotional: category === 'promotional',
                  }),
                ),
              )
            }
          >
            <Eye size={16} />
            Previzualizează emailul
          </button>
          {!saved ? (
            <button
              className="primary mail-action-contrast"
              disabled={busy || security || !preview || !recipients.length}
              onClick={() =>
                void run(async () => {
                  await api('/campaigns', 'POST', {
                    id: draftId,
                    template,
                    category,
                    subject,
                    message,
                    ctaLabel,
                    ctaPath,
                    recipients,
                  });
                  setSaved(true);
                  setData(await api());
                  setNotice('Ciornă salvată. Verifică destinatarii și confirmă trimiterea.');
                })
              }
            >
              Salvează ciorna verificată
            </button>
          ) : (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Am verificat conținutul, categoria și destinatarii.
              </label>
              <button
                className="primary"
                disabled={busy || !confirmed}
                onClick={() =>
                  void run(async () => {
                    const result = await api(`/campaigns/${draftId}/send`, 'POST');
                    setDetail(await api(`/campaigns/${draftId}`));
                    setData(await api());
                    setNotice(
                      result.remaining
                        ? 'Lot procesat. Apasă din nou pentru următorii destinatari.'
                        : 'Procesare încheiată. Consultă statusul fiecărui destinatar.',
                    );
                  })
                }
              >
                <Send size={16} />
                Trimite următorul lot (max. 2)
              </button>
            </>
          )}
        </section>
        <section className="card mail-preview">
          <div className="inline">
            <h2>Previzualizare</h2>
            <button aria-pressed={width === 'desktop'} onClick={() => setWidth('desktop')}>
              Desktop
            </button>
            <button aria-pressed={width === 'mobile'} onClick={() => setWidth('mobile')}>
              Mobil
            </button>
          </div>
          {preview ? (
            <>
              <p className="small muted">Subiect: {preview.subject}</p>
              <iframe
                title="Previzualizare email AutoCare"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={preview.html}
                style={{
                  width: width === 'mobile' ? 320 : '100%',
                  maxWidth: '100%',
                  height: 850,
                  border: 0,
                  display: 'block',
                  margin: '0 auto',
                }}
              />
              <details>
                <summary>Versiune text alternativă</summary>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{preview.text}</pre>
              </details>
            </>
          ) : (
            <p>
              Alege șablonul și apasă „Previzualizează emailul”. Previzualizarea de securitate
              folosește linkuri de exemplu către cont, fără tokenuri.
            </p>
          )}
        </section>
      </div>
      <section className="card stack">
        <h2>Aprobarea automatizărilor</h2>
        <p>
          Nu activa înainte de verificarea reală a tuturor șabloanelor, linkurilor, preferințelor și
          evenimentelor de plată. Aprobarea este înregistrată în audit; trimiterea rămâne blocată
          până la activarea separată pe server.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={approvalConfirmed}
            disabled={busy}
            onChange={(e) => setApprovalConfirmed(e.target.checked)}
          />
          Confirm că am testat toate șabloanele și am verificat livrarea reală în Inbox.
        </label>
        <button
          disabled={busy || !approvalConfirmed}
          onClick={() =>
            void run(async () => {
              await api('/approve', 'POST', {
                confirmAllTemplatesTested: true,
                confirmInboxDeliveryVerified: true,
              });
              setData(await api());
              setApprovalConfirmed(false);
              setNotice('Aprobare înregistrată. Activarea pe server este o etapă separată.');
            })
          }
        >
          Înregistrează aprobarea Fondatorului
        </button>
        {data.automation.approvedAt && (
          <p>Ultima aprobare: {new Date(data.automation.approvedAt).toLocaleString('ro-RO')}</p>
        )}
      </section>
      <section className="card">
        <div className="inline">
          <h2>Istoric și statusuri</h2>
          <button disabled={busy} onClick={() => void run(async () => setData(await api()))}>
            <RefreshCw size={16} />
            Reîncarcă
          </button>
        </div>
        <p className="small muted">
          „Acceptat” confirmă răspunsul Gmail API, nu livrarea în Inbox. Rezultatele incerte nu sunt
          retrimise automat. Ciornele salvate rămân nemodificabile; creează o ciornă nouă pentru
          schimbări.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subiect</th>
                <th>Categorie / sursă</th>
                <th>Status</th>
                <th>Detalii</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.subject}
                    <br />
                    <small>{new Date(c.createdAt).toLocaleString('ro-RO')}</small>
                  </td>
                  <td>
                    {c.category === 'promotional' ? 'Promoțional' : 'Tranzacțional'} /{' '}
                    {c.source === 'automation' ? 'automatizare' : 'manual'}
                  </td>
                  <td>
                    {Object.entries(c.counts).map(([key, n]) => (
                      <div key={key}>
                        {labels[key] || key}: {n}
                      </div>
                    ))}
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const result = await api(`/campaigns/${c.id}`);
                          setDetail(result);
                          if (c.source === 'manual') {
                            setDraftId(c.id);
                            setTemplate(c.template as EmailTemplate);
                            setSubject(c.subject);
                            setMessage(c.message);
                            setCtaLabel(c.ctaLabel);
                            setCtaPath(c.ctaPath);
                            setCategory(c.category as typeof category);
                            setSaved(true);
                            setConfirmed(false);
                            setPreview(null);
                            setRecipients(
                              result.deliveries.map((d: Detail['deliveries'][number]) => d.userId),
                            );
                          }
                        })
                      }
                    >
                      Deschide
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {detail && (
          <div>
            <h3>{detail.campaign.subject}</h3>
            <ul>
              {detail.deliveries.map((d) => (
                <li key={d.id}>
                  {d.name} · {d.email} — {labels[d.status] || d.status}
                  {d.error ? ` · ${d.error}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
