'use client';
import './mail-studio.css';
import {englishEmailCopy} from '@/lib/email-copy-en';
import {useApplicationLocale} from './application-locale';
import { useEffect, useState } from 'react';
import GoogleMailSettings from './google-mail-settings';
import { Mail, Eye, Send, Plus, RefreshCw } from 'lucide-react';
import type { mailCenterOverview, campaignDetail } from '@/lib/mail-center';
import { templateCategory } from '@/lib/email-templates';
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
const deliveryErrors: Record<string,string> = { GMAIL_AUTHORIZATION_FAILED: 'Gmail nu a autorizat trimiterea. Fondatorul trebuie să reconecteze Gmail și să refacă testul.', PREFERENCES_OR_EVENT_CHANGED: 'Preferințele destinatarului sau evenimentul asociat nu permit această trimitere.', GMAIL_HTTP_429: 'Google a respins cererea din cauza limitei de trimitere. Reîncearcă mai târziu.', GMAIL_HTTP_403: 'Google a refuzat trimiterea. Verifică autorizarea și limitele contului.', GMAIL_DELIVERY_UNCONFIRMED: 'Rezultat incert. Verifică Gmail înainte de a crea o nouă trimitere.' };
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

  const locale=useApplicationLocale();
  const en=locale==='en-GB', t=(ro:string,english:string)=>en?english:ro;
  const [englishSubject,setEnglishSubject]=useState(''),[englishMessage,setEnglishMessage]=useState(''),[englishCta,setEnglishCta]=useState('');
  const [previewLanguage,setPreviewLanguage]=useState<'ro'|'en'>(en?'en':'ro');
  const englishContent=englishSubject.trim()||englishMessage.trim()?{subject:englishSubject,message:englishMessage,ctaLabel:englishCta||'Open AutoCare'}:undefined;
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [libraryName, setLibraryName] = useState('');
  const [communicationType, setCommunicationType] = useState('Informare cont');
  const [section, setSection] = useState<'compose' | 'history' | 'automation'>('compose');
  const [gmailStatus, setGmailStatus] = useState<{connected: boolean; testedAt?: string | null; reconnectRequired?: boolean} | null>(null);
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
    [_confirmed, setConfirmed] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    void fetch('/api/v1/mail/google/status', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((v) => { if (active) setGmailStatus(v); })
      .catch(() => {});

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
    const timer = setInterval(() => { if (document.hidden || !navigator.onLine) return; void api().then((d: Overview) => { if (active) setData(d); }).catch(() => {}); }, 30000);
    return () => {
      clearInterval(timer);
      active = false;
    };
  }, []);
  function choose(id: EmailTemplate) {
    if (!data) return;
    const t = data.templates[id];
    setTemplate(id);
    setEnglishSubject('');setEnglishMessage('');setEnglishCta('');
    setSubject(t.subject);
    setMessage(t.body);
    setCtaLabel(t.cta);
    setCtaPath(t.path);
    setCategory(templateCategory(id));
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
    (u.emailVerified || category === 'transactional') &&
    u.emailEnabled !== false &&
    (category === 'promotional' ? u.promotional === true : u.transactional !== false);
  if (!data)
    return (
      <section className="card">
        <h2>AutoCare Mail Studio</h2>
        <p role="status">{error || 'Se încarcă…'}</p>
      </section>
    );
  return (
    <div className="mail-center mail-studio">
      <section className="card">
        <div className="inline">
          <Mail size={28} />
          <div>
            <p className="eyebrow">COMUNICARE AUTOCARE</p>
            <h2>AutoCare Mail Studio</h2>
          </div>
        </div>
        <p>
          {t('Mesaje clare. Un design îngrijit. Comunicări în limba fiecărui utilizator.','Clear messages. Thoughtful design. Communications in each user’s language.')}
        </p>
        {data.permissions.directSend && gmailStatus && (!gmailStatus.connected || !gmailStatus.testedAt) && (
          <p className="error" role="alert">
            Trimiterea manuală este blocată: {gmailStatus.connected
              ? 'Gmail este conectat, dar lipsește testul de trimitere.'
              : 'Gmail nu este conectat sau necesită reconectare.'}
            {' '}Deschide secțiunea „Conectare Gmail”, reconectează dacă este necesar și trimite un email de test.
          </p>
        )}
        {data.permissions.directSend && gmailStatus?.connected && !gmailStatus.testedAt && (
          <div className="card stack">
            <strong>Activează trimiterea manuală Gmail</strong>
            <p>Este necesar un singur email de test către adresa Gmail conectată. Nu se trimit mesaje către utilizatori în această etapă.</p>
            <button type="button" className="primary" disabled={busy}
              onClick={() => void run(async () => {
                const response = await fetch('/api/v1/mail/google/test', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Testul Gmail a eșuat.');
                const statusResponse = await fetch('/api/v1/mail/google/status', { cache: 'no-store' });
                if (!statusResponse.ok) throw new Error('Testul a fost acceptat, dar starea Gmail nu a putut fi actualizată.');
                setGmailStatus(await statusResponse.json());
                setNotice('Gmail a acceptat emailul de test. Verifică Inbox și Spam. Trimiterea manuală poate fi folosită acum.');
              })}>
              Trimite email de test și activează trimiterea
            </button>
          </div>
        )}
        <p className="notice">
          Automatizări: {data.automation.enabled && gmailStatus?.connected && gmailStatus.testedAt && !gmailStatus.reconnectRequired ? 'activate' : 'dezactivate'}. Administrare din secțiunea Automatizări.
        </p>
      </section>
      {data.permissions.canApprove && gmailStatus?.reconnectRequired && <GoogleMailSettings />}
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
      <nav className="mail-tabs" aria-label="Meniu Mail Center">
        <button type="button" aria-pressed={section === 'compose'} onClick={() => setSection('compose')}>Redactează</button>
        <button type="button" aria-pressed={section === 'history'} onClick={() => setSection('history')}>Istoric și aprobări {data.reviews.filter(x => x.status === 'pending').length || ''}</button>
        <button type="button" aria-pressed={section === 'automation'} onClick={() => setSection('automation')}>Automatizări</button>
      </nav>
      <div className="mail-center-grid" hidden={section !== 'compose'}>
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
          <div className="mail-quick-templates" aria-label={t('Pornire rapidă','Quick start')}>
            <button type="button" disabled={busy} onClick={()=>{choose('administrative');setSubject('');setMessage('');setPreview(null);}}>{t('Mesaj liber','Write your own')}</button>
            {(['welcome','release_news','premium_grant','support_reply'] as EmailTemplate[]).map(id=><button key={id} type="button" disabled={busy} onClick={()=>choose(id)}>{en?englishEmailCopy[id].title:data.templates[id].label}</button>)}
          </div>
          <p className="small muted">Șabloanele proprii se salvează în contul echipei și pot fi refolosite oricând.</p>
          <details className="mail-library"><summary>Șabloanele și tipurile mele</summary>
          <label>Biblioteca ta
            <select value="" disabled={busy || saved} onChange={e => {
              const entry = data.library.find(x => x.id === e.target.value);
              if (!entry) return;
              if (entry.kind === 'template') {
                choose(entry.template); setSubject(entry.subject); setMessage(entry.message);
                setCtaLabel(entry.ctaLabel); setCtaPath(entry.ctaPath);
                setEnglishSubject(entry.englishContent?.subject??'');setEnglishMessage(entry.englishContent?.message??'');setEnglishCta(entry.englishContent?.ctaLabel??'');
              }
              setCategory(entry.category); setCommunicationType(entry.kind === 'communication' ? entry.label : 'Informare cont'); setPreview(null);
            }}>
              <option value="">Alege un șablon sau tip propriu</option>
              {data.library.filter(x => templateCategory(template) !== 'promotional' || x.category === 'promotional').map(x => <option key={x.id} value={x.id}>{x.kind === 'template' ? 'Șablon' : 'Tip'}: {x.label} · {x.category === 'promotional' ? 'Promoțional' : 'Administrativ'}</option>)}
            </select>
          </label>
          <label>Nume șablon / tip nou<input maxLength={100} value={libraryName} onChange={e => setLibraryName(e.target.value)} /></label>
          <div className="inline">
            {(['template', 'communication'] as const).map(kind => <button key={kind} type="button" disabled={busy || security || libraryName.trim().length < 2} onClick={() => void run(async () => {
              await api('/library', 'POST', {id: crypto.randomUUID(), kind, label: libraryName, category, template, subject, message, ctaLabel, ctaPath, englishContent});
              setData(await api()); setLibraryName(''); setNotice('Salvat în biblioteca ta.');
            })}>{kind === 'template' ? 'Salvează ca șablon propriu' : 'Adaugă tip de comunicare'}</button>)}
          </div>
          {data.library.length > 0 && <details><summary>Gestionează biblioteca</summary>{data.library.map(x => <p key={x.id}>{x.label} <button type="button" disabled={busy} onClick={() => void run(async () => { await api('/library/' + x.id, 'DELETE'); setData(await api()); })}>Șterge</button></p>)}</details>}
          </details>
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
          {template === 'release_news' && <div className="form-grid">
            <label>{locale === 'ro-RO' ? 'Versiunea lansării' : 'Release version'}<input value={releaseVersion} maxLength={40} onChange={e => setReleaseVersion(e.target.value)} placeholder="2.4.0" /></label>
            <label>{locale === 'ro-RO' ? 'Data lansării' : 'Release date'}<input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} /></label>
            <p className="small muted">{locale === 'ro-RO' ? 'Anunțul intră în coadă pentru data aleasă. AutoCare verifică acordul pentru noutăți înainte de expediere.' : 'The release is queued for the selected date. AutoCare verifies news consent before sending.'}</p>
          </div>}
          <label>Tip de comunicare — alege sau scrie tu
            <input list="mail-communication-options" disabled={saved || busy} maxLength={100} value={communicationType} onChange={e => setCommunicationType(e.target.value)} placeholder="Ex.: Informare service, răspuns suport…" />
            <datalist id="mail-communication-options">{['Informare cont', 'Revizie și întreținere', 'Documente și expirări', 'Asistență tehnică', 'GPS și Bluetooth', 'Actualizare aplicație', 'Stare abonament', 'Incident tehnic', 'Mentenanță platformă', 'Confirmare solicitare', 'Răspuns reclamație', 'Anunț de serviciu', 'Feedback', 'Noutăți', 'Ofertă specială'].map(x => <option key={x} value={x} />)}{data.library.filter(x => x.kind === 'communication').map(x => <option key={x.id} value={x.label} />)}</datalist>
          </label>
          <label>
            Categoria de comunicare
            <select
              value={category}
              disabled={saved || busy || templateCategory(template) === 'promotional'}
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
            Subiect — alege o sugestie sau scrie tu
            <input
              list="mail-subject-options"
              maxLength={180}
              value={subject}
              disabled={saved || busy}
              onChange={(e) => {
                setSubject(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <datalist id="mail-subject-options">{Object.entries(data.templates).map(([key, t]) => <option key={key} value={t.subject} />)}{data.library.filter(x => x.kind === 'template').map(t => <option key={t.id} value={t.subject} />)}</datalist>
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
          <details className="mail-english-editor"><summary>{t('Versiune în engleză pentru destinatarii EN','English version for EN recipients')}</summary>
            <p>{t('Șabloanele standard se traduc automat. Pentru textul propriu, completează aici versiunea în engleză. Fără această versiune, mesajul propriu rămâne în limba în care l-ai scris.','Standard templates are localized automatically. For your own text, write the English version here. Without it, custom text is sent in the language you wrote.')}</p>
            <label>Subject · EN<input value={englishSubject} maxLength={180} disabled={saved||busy} onChange={e=>{setEnglishSubject(e.target.value);setPreview(null);}}/></label>
            <label>Message · EN<textarea value={englishMessage} rows={7} maxLength={8000} disabled={saved||busy} onChange={e=>{setEnglishMessage(e.target.value);setPreview(null);}}/></label>
            <label>Button · EN<input value={englishCta} placeholder="Open AutoCare" maxLength={60} disabled={saved||busy} onChange={e=>setEnglishCta(e.target.value)}/></label>
          </details>
          <details><summary>Personalizează butonul și linkul</summary>
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
          </details>
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
          <div className="inline" style={{ flexWrap: 'wrap', gap: 10 }}>
            <button type="button" disabled={busy || saved} onClick={() => {
              const matching = data.users.filter((u) =>
                (u.name + ' ' + u.email).toLowerCase().includes(search.toLowerCase()) && eligible(u)
              );
              setRecipients((old) => [...new Set([...old, ...matching.map((u) => u.id)])].slice(0, 50));
              setPreview(null);
            }}>Bifează utilizatorii afișați</button>
            <button type="button" disabled={busy || saved || recipients.length === 0} onClick={() => {
              setRecipients([]);
              setPreview(null);
            }}>Debifează toți</button>
          </div>
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
                    language:previewLanguage,
                    template,
                    subject,
                    message,
                    ctaLabel,
                    ctaPath,
                    name: selectedName,
                    ...(previewLanguage==='en'&&englishContent?englishContent:{}),
                    promotional: category === 'promotional',
                  }),
                ),
              )
            }
          >
            <Eye size={16} />
            Previzualizează emailul
          </button>
          <button
            type="button"
            className="mail-send-action"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', minHeight: 60, padding: '16px 20px', border: '2px solid #102e61', borderRadius: 10, fontSize: 16, fontWeight: 800, backgroundColor: '#153e7a', color: '#ffffff', WebkitTextFillColor: '#ffffff', opacity: 1, cursor: busy || security || !recipients.length || !subject.trim() || !message.trim() ? 'not-allowed' : 'pointer' }}
            aria-disabled={busy || security || !recipients.length || !subject.trim() || !message.trim()}
            onClick={() => {
              if (busy || security || !recipients.length || !subject.trim() || !message.trim()) return;
              void run(async () => {
              if (data.permissions.directSend && gmailStatus && !gmailStatus.connected) {
                throw new Error('Contul Gmail nu este conectat. Apasă „Conectează Gmail” din Panoul Fondator.');
              }
              if (data.permissions.directSend && gmailStatus && !gmailStatus.testedAt) {
                const testResponse = await fetch('/api/v1/mail/google/test', { method: 'POST' });
                const testResult = await testResponse.json();
                if (!testResponse.ok) throw new Error(testResult.error || 'Testul Gmail a eșuat. Emailurile nu au fost trimise.');
                const statusResponse = await fetch('/api/v1/mail/google/status', { cache: 'no-store' });
                if (!statusResponse.ok) throw new Error('Testul Gmail a fost acceptat, dar starea nu a putut fi verificată.');
                const updated = await statusResponse.json();
                setGmailStatus(updated);
                if (!updated.testedAt) throw new Error('Gmail nu a confirmat activarea. Nu au fost trimise mesaje către destinatari.');
              }
              if (!saved) {
                await api('/campaigns', 'POST', {
                  id: draftId, template, category, communicationType, subject, message, ctaLabel, ctaPath, recipients, englishContent,
                });
                setSaved(true);
              }
              if (!data.permissions.directSend && !data.reviews.some(x => x.campaignId === draftId && x.status === 'approved')) {
                await api(`/campaigns/${draftId}/request-approval`, 'POST');
                setData(await api()); setNotice('Cererea apare în Mail Center-ul Fondatorului. Nu s-au trimis emailuri.'); setSection('history'); return;
              }
              if (template === 'release_news') {
                if (!data.permissions.canApprove) throw new Error('Doar Fondatorul poate publica o lansare.');
                await api(`/campaigns/${draftId}/publish-release`, 'POST', { version: releaseVersion, releaseDate });
                setData(await api());
                setNotice('Lansarea a fost programată. Starea expedierii apare în istoric.');
                setSection('history');
                return;
              }
              let total = 0;
              let remaining = true;
              for (let batch = 0; batch < 15 && remaining; batch++) {
                const result = await api(`/campaigns/${draftId}/send`, 'POST');
                total += result.accepted || 0;
                remaining = !!result.remaining;
                if (remaining) await new Promise((resolve) => setTimeout(resolve, 4100));
              }
              const latest: Detail = await api(`/campaigns/${draftId}`);
              setDetail(latest);
              setData(await api());
              const issues = latest.deliveries.filter((d) => ['failed', 'unknown', 'suppressed'].includes(d.status));
              setNotice(`${total} emailuri acceptate de Gmail.${remaining ? ' Mai sunt destinatari în așteptare: apasă din nou Trimite.' : ' Trimiterea a fost procesată.'}`);
              if (issues.length) {
                const reasons = [...new Set(issues.map(d => deliveryErrors[d.error || ''] || (d.status === 'suppressed' ? 'Trimitere omisă conform preferințelor sau stării evenimentului.' : 'Verifică detaliile de mai jos.')))];
                setError(`${issues.length} emailuri necesită atenție. ${reasons.join(' ')}`);
                setSection('history');
              }
              });
            }}
          >
            <Send size={17} /> {busy ? 'Se procesează…' : !data.permissions.directSend && !data.reviews.some(x => x.campaignId === draftId && x.status === 'approved') ? 'Trimite Fondatorului pentru aprobare' : template === 'release_news' ? 'Programează AutoCare News' : saved ? 'Continuă trimiterea emailurilor' : recipients.length ? `Trimite emailul către ${recipients.length} destinatari` : 'Bifează un destinatar pentru trimitere'}
          </button>
          {!recipients.length && <p className="small muted">Bifează cel puțin un destinatar pentru a activa trimiterea.</p>}
          {data.permissions.directSend && gmailStatus && !gmailStatus.testedAt && (
            <p className="small muted">La prima trimitere, AutoCare verifică automat Gmail. Dacă testul eșuează, nu expediază mesajele către destinatari.</p>
          )}
        </section>
        <section className="card mail-preview">
          <div className="inline">
            <h2>Previzualizare</h2>
            <select aria-label={t('Limba previzualizării','Preview language')} value={previewLanguage} onChange={e=>{setPreviewLanguage(e.target.value as 'ro'|'en');setPreview(null);}}><option value="ro">RO</option><option value="en">EN</option></select>
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
      <section className="card stack mail-automation-card" hidden={section !== 'automation'}>
        <p className="eyebrow">AUTOCARE · AUTOMATIONS</p><h2>Automatizări</h2>
        <div className="mail-automation-flows">
          <article><strong>{t('Bun venit','Welcome')}</strong><p>{t('La crearea contului · un singur mesaj · limba aleasă de utilizator','On signup · one message · the user’s selected language')}</p></article>
          <article><strong>AutoCare News</strong><p>{t('La publicarea unei versiuni din Mail Studio · destinatari cu acord pentru noutăți','On release publication in Mail Studio · opted-in news recipients')}</p></article>
          <article><strong>{t('Procesare automată','Automatic delivery')}</strong><p>{t('Coada este verificată periodic cât serverul rulează și după înregistrări. Render Free suspendă procesarea când serviciul doarme.','The queue is checked while the server runs and after signup. Render Free pauses processing while the service sleeps.')}</p></article>
        </div>
        <p className="mail-status">{data.automation.enabled&&gmailStatus?.connected&&gmailStatus.testedAt&&!gmailStatus.reconnectRequired ? 'Automatizările sunt active.' : 'Automatizările sunt oprite.'}</p>
        <p>{data.permissions.directSend ? 'Poți autoriza automatizările direct. Preferințele utilizatorilor și regulile de livrare rămân active.' : 'Solicitarea ta ajunge în Mail Center-ul Fondatorului pentru aprobare.'}</p>
        <button className="primary" disabled={busy} onClick={() => void run(async () => {
          if (data.permissions.directSend) {
            await api('/approve', 'POST', { confirmEnable: true });
            setNotice('Autorizare înregistrată.' + (!data.automation.deploymentGate ? ' Activarea pe server este încă oprită.' : ''));
          } else {
            await api('/approval-request', 'POST'); setNotice('Cerere trimisă Fondatorului.');
          }
          setData(await api());
        })}>{data.permissions.directSend ? 'Autorizează automatizările' : 'Solicită aprobarea Fondatorului'}</button>
        {data.automation.approvedAt && <p>Ultima autorizare: {new Date(data.automation.approvedAt).toLocaleString(locale)}</p>}
        {data.permissions.canApprove && data.automationRequests.length > 0 && <div className="mail-review-list"><h3>Cereri pentru tine</h3>{data.automationRequests.map(x => <p key={x.requestedBy}>Cerere de activare automatizări · {data.users.find(u => u.id === x.requestedBy)?.name || x.requestedBy} · {new Date(x.requestedAt).toLocaleString(locale)}</p>)}</div>}
      </section>
      <section className="card" hidden={section !== 'history'}>
        <div className="inline">
          <h2>Istoric și statusuri</h2>
          <button disabled={busy} onClick={() => void run(async () => setData(await api()))}>
            <RefreshCw size={16} />
            Reîncarcă
          </button>
        </div>
        {data.reviews.length > 0 && <div className="mail-review-list"><h3>Aprobări comunicări</h3>{data.reviews.map(review => <div className="mail-review-item" key={review.campaignId}>
          <strong>{data.campaigns.find(x => x.id === review.campaignId)?.subject || 'Comunicare'}</strong>
          <p>{data.users.find(u => u.id === review.requestedBy)?.name || review.requestedBy} · {review.status === 'pending' ? 'Așteaptă aprobarea Fondatorului' : review.status === 'approved' ? 'Aprobată' : 'Respinsă'}</p>
          <button disabled={busy} onClick={() => void run(async () => { setDetail(await api(`/campaigns/${review.campaignId}`)); })}>Vezi conținutul și destinatarii</button>
          {data.permissions.canApprove && review.status === 'pending' && <>{[true, false].map(approve => <button key={String(approve)} disabled={busy} onClick={() => void run(async () => { await api(`/campaigns/${review.campaignId}/review`, 'POST', { approve }); setData(await api()); setNotice(approve ? 'Comunicare aprobată. Expedierea se face separat.' : 'Comunicare respinsă.'); })}>{approve ? 'Aprobă' : 'Respinge'}</button>)}</>}
        </div>)}</div>}
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
                    <small>{new Date(c.createdAt).toLocaleString(locale)}</small>
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
                            setCommunicationType(result.communicationType);
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
            <h3>{detail.campaign.subject}</h3><p>{detail.communicationType}</p><p style={{whiteSpace: 'pre-wrap'}}>{detail.campaign.message}</p><p>{detail.campaign.ctaLabel} · {detail.campaign.ctaPath}</p>
            {detail.deliveries.some(d => d.status === 'failed') && <button disabled={busy} onClick={() => void run(async () => {
              const result = await api(`/campaigns/${detail.campaign.id}/retry-failed`, 'POST');
              setDetail(await api(`/campaigns/${detail.campaign.id}`)); setData(await api());
              setNotice(`${result.requeued} emailuri eșuate sunt pregătite pentru reîncercare. Deschide comunicarea din istoric și apasă Continuă trimiterea după reconectarea Gmail. Cele acceptate, incerte sau omise nu sunt retrimise.`);
            })}>Pregătește reîncercarea emailurilor eșuate</button>}
            <ul>
              {detail.deliveries.map((d) => (
                <li key={d.id}>
                  {d.name} · {d.email} — {labels[d.status] || d.status}
                  {d.error ? ` · ${deliveryErrors[d.error] || d.error}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
