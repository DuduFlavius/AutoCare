'use client';
import {FilterSelect} from '@/components/filter-select';

import {PremiumDateInput} from './premium-date-input';
import './mail-studio.css';
import {englishEmailCopy} from '@/lib/email-copy-en';
import {useApplicationLocale} from './application-locale';
import { useEffect, useState } from 'react';
import GoogleMailSettings, {googleMailRequest,type GmailStatus} from './google-mail-settings';
import { Mail, Eye, Send, Plus, RefreshCw, LayoutDashboard, PenLine, LayoutTemplate, Megaphone, Users, Zap, CalendarClock, History, ChartNoAxesColumn, Activity, Settings2, ArrowRight, CircleCheck } from 'lucide-react';
import { EmailGallery, defaultStudioStyle } from './mail-studio-gallery';
import MailRichText from './mail-rich-text';
import {MailPresetField} from './mail-preset-field';
import {mailTopic,mailTopics} from '@/lib/mail-topics';
import {studioStyles,type StudioStyle} from '@/lib/mail-studio-templates';
import type { mailCenterOverview, campaignDetail } from '@/lib/mail-center';
import { emailCategory, emailCategories } from '@/lib/mail-preference-categories';
import { requestConfirmation } from './premium-dialogs';
import { templateCategory } from '@/lib/email-templates';
import type { EmailTemplate, EmailContent } from '@/lib/email-templates';
type Overview = Awaited<ReturnType<typeof mailCenterOverview>>;
type Detail = Awaited<ReturnType<typeof campaignDetail>>;
async function api(path = '', method = 'GET', body?: unknown, signal?:AbortSignal) {
  const r = await fetch('/api/v1/founder/mail' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal,
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
  scheduled: 'Programat',
  cancelled: 'Anulat',
};
const lifecycleRows = [
  ['welcome','Bun venit','Welcome','Cont nou cu adresă confirmată','New account with a verified email','welcome'],
  ['releaseWeb','Actualizări web','Web updates','Lansare web verificată și aprobată','Verified and approved web release','release_news'],
  ['releaseAndroid','Actualizări Android','Android updates','APK publicat, semnătură și SHA-256 verificate','Published APK with verified signature and SHA-256','release_news'],
  ['documents','Expirare documente','Document deadlines','Termene și intervale din preferințele utilizatorului','Deadlines and intervals from account preferences','reminder'],
  ['premium','Bun venit în Premium','Premium welcome','Acces Premium acordat de echipă','Premium access granted by the team','premium_grant'],
  ['monthly','Rezumat lunar','Monthly summary','Date reale și opțiune activată de destinatar','Real data and recipient opt-in','monthly_report'],
  ['support','Mesaje de suport','Support messages','Cerere înregistrată, răspuns sau rezolvare','Request received, reply or resolution','support_reply'],
] as const;
const studioSections = [
  ['overview','Prezentare generală','Overview',LayoutDashboard],
  ['compose','Redactare','Compose',PenLine],
  ['library','Bibliotecă de șabloane','Template library',LayoutTemplate],
  ['campaigns','Campanii','Campaigns',Megaphone],
  ['audiences','Audiențe','Audiences',Users],
  ['automation','Automatizări','Automations',Zap],
  ['scheduled','Emailuri programate','Scheduled emails',CalendarClock],
  ['history','Istoric și aprobări','History & approvals',History],
  ['analytics','Statistici','Statistics',ChartNoAxesColumn],
  ['delivery','Livrabilitate','Deliverability',Activity],
  ['settings','Configurare','Settings',Settings2],
] as const;
type StudioSection = typeof studioSections[number][0];
const steps = [
  ['Șablon','Template'],['Audiență','Audience'],['Conținut','Content'],['Previzualizare','Preview'],['Trimitere','Send'],
] as const;
export default function MailCenter() {

  const locale=useApplicationLocale();
  const en=locale==='en-GB', t=(ro:string,english:string)=>en?english:ro;
  const [englishSubject,setEnglishSubject]=useState(''),[englishMessage,setEnglishMessage]=useState(''),[englishCta,setEnglishCta]=useState('');
  const [previewLanguage,setPreviewLanguage]=useState<'ro'|'en'>(en?'en':'ro');
  const englishContent=englishSubject.trim()||englishMessage.trim()?{subject:englishSubject,message:englishMessage,ctaLabel:englishCta||'Open AutoCare'}:undefined;
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [style,setStyle]=useState<StudioStyle>('signature');
  const [preheader,setPreheader]=useState('');
  const [englishPreheader,setEnglishPreheader]=useState('');
  const [formatted,setFormatted]=useState(false);
  const design={style,preheader,englishPreheader,formatted};
  const [previewError,setPreviewError]=useState('');
  const [step,setStep]=useState(0);
  const [releaseMode,setReleaseMode]=useState<'approval'|'auto'>('approval');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseCommit,setReleaseCommit]=useState('');
  const [releaseTests,setReleaseTests]=useState(false);
  const [androidRelease,setAndroidRelease]=useState(false);
  const [androidVersion,setAndroidVersion]=useState('');
  const [androidHash,setAndroidHash]=useState('');
  const [androidSignature,setAndroidSignature]=useState(false);
  const [scheduledAt,setScheduledAt]=useState('');
  const [segment,setSegment]=useState<''|'all'|'garage'|'no_garage'>('');
  const [segmentCount,setSegmentCount]=useState<number|null>(null);
  const [libraryName, setLibraryName] = useState('');
  const [templateLabel,setTemplateLabel]=useState(''),[categoryLabel,setCategoryLabel]=useState('');
  const [communicationType, setCommunicationType] = useState('Informare cont');
  const [section, setSection] = useState<StudioSection>('overview');
  const [gmailStatus, setGmailStatus] = useState<GmailStatus|null>(null);
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
  const [automationQuery,setAutomationQuery]=useState('');
  const [automationFilter,setAutomationFilter]=useState('all');
  const [automationResult,setAutomationResult]=useState('any');
  const [automationPreview,setAutomationPreview]=useState<EmailContent|null>(null);
  const [automationExample,setAutomationExample]=useState<(typeof lifecycleRows)[number] | null>(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historySource, setHistorySource] = useState('');
  const [historyCategory, setHistoryCategory] = useState('');
  const [historyTopic,setHistoryTopic]=useState('');
  const [historyTemplate,setHistoryTemplate]=useState('');
  const [historyEnd,setHistoryEnd]=useState('');
  const [historyDate, setHistoryDate] = useState('');
  useEffect(() => {
    let active = true;
    void googleMailRequest('status').then(value=>{if(active)setGmailStatus(value);}).catch(()=>{});
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
    const topic=mailTopics.find(item=>item.id===mailTopic(id));
    setCommunicationType(topic?.ro??'Comunicare generală');setCategoryLabel(topic?.ro??'');setTemplateLabel(t.label);
    setStyle(defaultStudioStyle(id));setPreheader(t.body.slice(0,130));setEnglishPreheader(englishEmailCopy[id]?.body.slice(0,130)??'');setFormatted(false);
    setEnglishSubject('');setEnglishMessage('');setEnglishCta('');
    setSubject(t.subject);
    setMessage(t.body);
    setCtaLabel(t.cta);
    setCtaPath(t.path);
    setCategory(templateCategory(id));
    setSegmentCount(null);
    setPreview(null);
    setSaved(false);
    setDraftId(crypto.randomUUID());
    setConfirmed(false);
  }
  function chooseFromGallery(id:string) {
    const entry=data?.library.find(item=>item.id===id&&item.kind==='template');
    choose(entry?.template??id as EmailTemplate);
    if(entry) {
      setTemplateLabel(entry.label);
      setSubject(entry.subject);setMessage(entry.message);setCtaLabel(entry.ctaLabel);setCtaPath(entry.ctaPath);setCategory(entry.category);
      setEnglishSubject(entry.englishContent?.subject??'');setEnglishMessage(entry.englishContent?.message??'');setEnglishCta(entry.englishContent?.ctaLabel??'');
      if(entry.design){setStyle(entry.design.style);setPreheader(entry.design.preheader??'');setEnglishPreheader(entry.design.englishPreheader??'');setFormatted(entry.design.formatted??false);}
    }
    setPreviewLanguage(en?'en':'ro');setSection('compose');setStep(1);
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
  const security = ['verification', 'password_reset', 'gmail_test','account_security','monthly_report'].includes(template);
  const topics = emailCategory(template,category==='promotional');
  const hasAudience = segment ? (segmentCount??0)>0 : recipients.length>0;
  const draft = {id:draftId,template,category,communicationType,templateLabel,categoryLabel,subject,message,ctaLabel,ctaPath,design,
    ...(segment?{segment}:{recipients}),englishContent};
  const canDraft = !busy && !security && hasAudience && subject.trim().length>=3 && message.trim().length>=10;
  const selectedName = data?.users.find((u) => u.id === recipients[0])?.name || 'prietene';
  useEffect(()=>{
    if(section!=='compose'||step===0)return;
    const controller=new AbortController();
    const timeout=setTimeout(()=>{
      void api('/preview','POST',{
        language:previewLanguage,template,
        subject:previewLanguage==='en'&&englishSubject.trim()?englishSubject:subject,
        message:previewLanguage==='en'&&englishMessage.trim()?englishMessage:message,
        ctaLabel:previewLanguage==='en'&&englishCta.trim()?englishCta:ctaLabel,
        ctaPath,name:selectedName,promotional:category==='promotional',
        design:{style,preheader,englishPreheader,formatted},previewTheme:theme,
      },controller.signal).then((content:EmailContent)=>{
        if(!controller.signal.aborted){setPreview(content);setPreviewError('');}
      }).catch((e:Error)=>{if(!controller.signal.aborted)setPreviewError(e.message);});
    },275);
    return ()=>{clearTimeout(timeout);controller.abort();};
  },[section,step,previewLanguage,template,subject,message,ctaLabel,ctaPath,selectedName,category,
    style,preheader,englishPreheader,formatted,theme,englishSubject,englishMessage,englishCta]);
  const eligible = (u: Overview['users'][number]) =>
    (u.emailVerified || category === 'transactional') &&
    !u.suspendedAt && u.emailEnabled !== false &&
    (topics ? emailCategories(u.categories,u.promotional??false)[topics] : u.transactional !== false);
  if (!data)
    return (
      <section className="card">
        <h2>AutoCare Mail Studio</h2>
        <p role="status">{error || 'Se încarcă…'}</p>
      </section>
    );
  const templateChoices=Object.entries(data.templates).map(([id,entry])=>({value:entry.label,label:en?(englishEmailCopy[id]?.title??entry.label):entry.label}));
  const topicChoices=mailTopics.map(item=>({value:item.ro,label:en?item.en:item.ro}));
  const choices=(base:{value:string;label:string}[], additional:string[])=>[...new Map([...base,...additional.map(value=>({value,label:value}))].map(item=>[item.value,item])).values()];
  const history = data.campaigns.filter(campaign => {
    const matchesText = !historyQuery.trim() || [campaign.subject, campaign.message, campaign.template].some(value=>value.toLocaleLowerCase().includes(historyQuery.trim().toLocaleLowerCase()));
    const matchesView=section==='scheduled'?campaign.scheduledAt!==null&&['scheduled','sending','held'].includes(campaign.status):
      section==='campaigns'?campaign.source==='manual'||campaign.template==='release_news':true;
    return matchesText && matchesView && (!historyStatus || campaign.status === historyStatus || Number((campaign.counts as Record<string,number>)[historyStatus]) > 0) &&
      (!historySource || campaign.source === historySource) && (!historyCategory || campaign.category === historyCategory) &&
      (!historyTopic || mailTopic(campaign.template)===historyTopic) && (!historyTemplate || campaign.template===historyTemplate) &&
      (!historyDate || new Date(campaign.createdAt).toLocaleDateString('en-CA') >= historyDate) &&
      (!historyEnd || new Date(campaign.createdAt).toLocaleDateString('en-CA') <= historyEnd);
  });

  return (
    <div className="mail-center mail-studio">
      <header className="studio-masthead">
        <div className="studio-brand"><span className="studio-brand-mark"><Mail size={24}/></span><div><h2>Mail Studio</h2><p>{t('Comunicări AutoCare','AutoCare communications')}</p></div></div>
        <button type="button" className="studio-primary" disabled={busy} onClick={()=>{choose('administrative');setRecipients([]);setSegment('');setDetail(null);setSection('compose');setStep(0);}}>
          <Plus size={17}/>{t('Ciornă nouă','New draft')}
        </button>
      </header>
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
      <nav className="studio-navigation" aria-label={t('Meniu Mail Studio','Mail Studio navigation')}>
        {studioSections.map(([id,ro,english,Icon])=><button key={id} type="button" aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}><Icon size={17}/><span>{t(ro,english)}</span></button>)}
      </nav>
      {data.permissions.canApprove && (section==='overview'||section==='settings'||section==='compose'&&step===4) &&
        <GoogleMailSettings compact={section!=='settings'} onStatus={setGmailStatus}/>}
      {['overview','analytics','delivery'].includes(section) && <section className="studio-surface studio-overview">
        <header className="studio-section-heading"><div><h2>{t(...(section==='overview'?['Prezentare generală','Overview']:section==='analytics'?['Statistici','Statistics']:['Livrabilitate','Deliverability']) as [string,string])}</h2>
          <p>{section==='delivery'?t('Stările raportate de furnizor.','Statuses reported by the provider.'):t('Activitatea de comunicare din AutoCare.','Communication activity across AutoCare.')}</p></div>
          <button type="button" disabled={busy} onClick={()=>void run(async()=>setData(await api()))}><RefreshCw size={16}/>{t('Reîncarcă','Refresh')}</button>
        </header>
        <div className="studio-metrics">
          {([['accepted','Acceptate','Accepted'],['delivered','Livrare confirmată','Confirmed deliveries'],['failed','Eșecuri / incerte','Failed / uncertain'],['bounces','Respingeri','Bounces'],['unsubscribed','Dezabonări','Unsubscribes']] as const).map(([key,ro,english])=>
            <article key={key}><span>{t(ro,english)}</span><strong>{data.stats[key].toLocaleString(locale)}</strong></article>)}
        </div>
        {section==='analytics' ? <div className="studio-chart" aria-label={t('Comparație a rezultatelor','Delivery outcome comparison')}>
          {([['accepted','Acceptate','Accepted'],['delivered','Confirmate','Confirmed'],['failed','Eșuate','Failed']] as const).map(([key,ro,english])=><div key={key}><span>{t(ro,english)}</span><meter min={0} max={Math.max(1,data.stats.accepted,data.stats.delivered,data.stats.failed)} value={data.stats[key]} aria-label={t(ro,english)}/><strong>{data.stats[key]}</strong></div>)}
        </div> : <div className="studio-overview-bottom">
          <article><h3>{t('Conexiune Gmail','Gmail connection')}</h3><p>{gmailStatus?.connected&&gmailStatus.testedAt&&!gmailStatus.reconnectRequired?t('Conectată și testată','Connected and tested'):t('Necesită configurare sau test','Setup or testing required')}</p><button type="button" onClick={()=>setSection('settings')}><Settings2 size={16}/>{t('Deschide configurarea','Open settings')}</button></article>
          <article><h3>{section==='delivery'?t('Confirmarea livrării','Delivery confirmation'):t('Automatizări','Automations')}</h3><p>{section==='delivery'?t('Confirmările provin din evenimentele providerului. Gmail raportează acceptarea mesajului.','Delivery confirmations come from provider events. Gmail reports message acceptance.'):data.automation.enabled?t('Autorizate pe server','Authorized on the server'):t('În așteptarea configurării','Awaiting setup')}</p><button type="button" onClick={()=>setSection(section==='delivery'?'history':'automation')}><ArrowRight size={16}/>{section==='delivery'?t('Vezi istoricul','View history'):t('Deschide automatizările','Open automations')}</button></article>
        </div>}
      </section>}
      {section==='compose'&&<ol className="studio-steps" aria-label={t('Pași de redactare','Composition steps')}>
        {steps.map(([ro,english],index)=><li key={ro}><button type="button" aria-current={step===index?'step':undefined} onClick={()=>setStep(index)}><span>{step>index?<CircleCheck size={15}/>:index+1}</span>{t(ro,english)}</button></li>)}
      </ol>}
      {(section==='library'||(section==='compose'&&step===0)) && <>
        {section==='compose'&&<button className="studio-freeform" type="button" disabled={busy} onClick={()=>{choose('administrative');setSubject('');setMessage('');setPreheader('');setEnglishPreheader('');setStep(1);}}><PenLine size={16}/>{t('Începe fără șablon','Start from scratch')}</button>}
        <EmailGallery language={en?'en':'ro'} disabled={busy} onChoose={chooseFromGallery} entries={[
          ...Object.entries(data.templates).map(([id,entry])=>({id,template:id as EmailTemplate,label:entry.label,subject:entry.subject,message:entry.body,ctaLabel:entry.cta,ctaPath:entry.path,category:templateCategory(id as EmailTemplate)})),
          ...data.library.filter(item=>item.kind==='template'),
        ]}/>
      </>}
      <div className="mail-center-grid" data-audience={section==='audiences'} hidden={section!=='audiences'&&(section!=='compose'||step===0)}>
        <section className="studio-surface studio-editor">
          <header className="studio-section-heading">
            <div><h2>{section==='audiences'?t('Audiențe','Audiences'):t(steps[step][0],steps[step][1])}</h2><p>{t('Model selectat','Selected template')}{' · '}{en?englishEmailCopy[template]?.title:data.templates[template].label}</p></div>
          </header>
          <div className="studio-fields" hidden={section!=='compose'||step!==2}>
          <details className="mail-library"><summary>Șabloanele și tipurile mele</summary>
          <label>Biblioteca ta
            <FilterSelect value="" disabled={busy || saved} onChange={e => {
              const entry = data.library.find(x => x.id === e.target.value);
              if (!entry) return;
              if (entry.kind === 'template') {
                choose(entry.template); setSubject(entry.subject); setMessage(entry.message);
                setCtaLabel(entry.ctaLabel); setCtaPath(entry.ctaPath);
                if(entry.design){setStyle(entry.design.style);setPreheader(entry.design.preheader??'');setEnglishPreheader(entry.design.englishPreheader??'');setFormatted(entry.design.formatted??false);}
                setEnglishSubject(entry.englishContent?.subject??'');setEnglishMessage(entry.englishContent?.message??'');setEnglishCta(entry.englishContent?.ctaLabel??'');
              }
              setCategory(entry.category); setCommunicationType(entry.kind === 'communication' ? entry.label : 'Informare cont'); setPreview(null);
            }}>
              <option value="">Alege un șablon sau tip propriu</option>
              {data.library.filter(x => templateCategory(template) !== 'promotional' || x.category === 'promotional').map(x => <option key={x.id} value={x.id}>{x.kind === 'template' ? 'Șablon' : 'Tip'}: {x.label} · {x.category === 'promotional' ? 'Promoțional' : 'Administrativ'}</option>)}
            </FilterSelect>
          </label>
          <label>Nume șablon / tip nou<input maxLength={100} value={libraryName} onChange={e => setLibraryName(e.target.value)} /></label>
          <div className="inline">
            {(['template', 'communication'] as const).map(kind => <button key={kind} type="button" disabled={busy || security || libraryName.trim().length < 2} onClick={() => void run(async () => {
              await api('/library', 'POST', {id: crypto.randomUUID(), kind, label: libraryName, category, template, subject, message, ctaLabel, ctaPath, englishContent, design});
              setData(await api()); setLibraryName(''); setNotice('Salvat în biblioteca ta.');
            })}>{kind === 'template' ? 'Salvează ca șablon propriu' : 'Adaugă tip de comunicare'}</button>)}
          </div>
          {data.library.length > 0 && <details><summary>Gestionează biblioteca</summary>{data.library.map(x => <p key={x.id}>{x.label} <button type="button" disabled={busy} onClick={() => void run(async () => { await api('/library/' + x.id, 'DELETE'); setData(await api()); })}>Șterge</button></p>)}</details>}
          </details>
          <label>
            Șablon
            <FilterSelect
              value={template}
              disabled={saved || busy}
              onChange={(e) => choose(e.target.value as EmailTemplate)}
            >
              {Object.entries(data.templates).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.label}
                </option>
              ))}
            </FilterSelect>
          </label>
          {template === 'release_news' && <div className="form-grid">
            <label>{locale === 'ro-RO' ? 'Versiunea lansării' : 'Release version'}<input value={releaseVersion} maxLength={40} onChange={e => setReleaseVersion(e.target.value)} placeholder="2.4.0" /></label>
            <label>{locale === 'ro-RO' ? 'Data lansării' : 'Release date'}<PremiumDateInput type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} /></label>
            <label>{t('Commit GitHub publicat','Published GitHub commit')}<input value={releaseCommit} maxLength={40} onChange={e=>setReleaseCommit(e.target.value.trim())}/></label>
            <label className="check"><input type="checkbox" checked={releaseTests} onChange={e=>setReleaseTests(e.target.checked)}/>{t('Confirm că buildul și testele acestei versiuni au trecut.','I confirm this release passed its build and tests.')}</label>
            <label className="check"><input type="checkbox" checked={androidRelease} onChange={e=>setAndroidRelease(e.target.checked)}/>{t('Include un APK Android nou','Includes a new Android APK')}</label>
            {androidRelease && <>
              <label>{t('Versiune Android','Android version')}<input value={androidVersion} maxLength={32} onChange={e=>setAndroidVersion(e.target.value.trim())}/></label>
              <label>SHA-256 APK<input value={androidHash} maxLength={64} onChange={e=>setAndroidHash(e.target.value.trim().toLowerCase())}/></label>
              <label className="check"><input type="checkbox" checked={androidSignature} onChange={e=>setAndroidSignature(e.target.checked)}/>{t('Am verificat semnătura APK-ului','I verified the APK signature')}</label>
            </>}
          </div>}
          <div className="studio-filters studio-classification">
            <MailPresetField label={t('Tip de comunicare','Communication type')} value={communicationType} choices={choices(topicChoices,[...templateChoices.map(x=>x.value),...data.library.filter(x=>x.kind==='communication').map(x=>x.label)])} onChange={setCommunicationType} disabled={saved||busy} en={en}/>
            <MailPresetField label={t('Nume șablon','Template name')} value={templateLabel} choices={choices(templateChoices,data.library.filter(x=>x.kind==='template').map(x=>x.label))} onChange={setTemplateLabel} disabled={saved||busy} en={en}/>
            <MailPresetField label={t('Etichetă categorie','Category label')} value={categoryLabel} choices={topicChoices} onChange={setCategoryLabel} disabled={saved||busy} en={en}/>
          </div>
          <label>
            Categoria de comunicare
            <FilterSelect
              value={category}
              disabled={saved || busy || templateCategory(template) === 'promotional'}
              onChange={(e) => {
                setCategory(e.target.value as typeof category);
                setSegmentCount(null);setPreview(null);
              }}
            >
              <option value="transactional">Tranzacțional / administrativ necesar</option>
              <option value="promotional">Promoțional — doar cu acord</option>
            </FilterSelect>
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
          <label>{t('Preheader','Preheader')}<input value={preheader} disabled={saved||busy} maxLength={130} onChange={e=>setPreheader(e.target.value)}/></label>
          <MailRichText formatLabel={t('Formatare','Formatting')} label={t('Mesaj','Message')} value={message} onChange={setMessage} onFormat={()=>setFormatted(x=>!x)} enabled={formatted} disabled={saved||busy}/>
          <label>{t('Stil vizual','Visual style')}<FilterSelect value={style} disabled={saved||busy} onChange={e=>setStyle(e.target.value as StudioStyle)}>{studioStyles.map(id=><option key={id}>{id}</option>)}</FilterSelect></label>
          <details className="mail-english-editor"><summary>{t('Versiune în engleză pentru destinatarii EN','English version for EN recipients')}</summary>
            <p>{t('Șabloanele standard se traduc automat. Pentru textul propriu, completează aici versiunea în engleză. Fără această versiune, mesajul propriu rămâne în limba în care l-ai scris.','Standard templates are localized automatically. For your own text, write the English version here. Without it, custom text is sent in the language you wrote.')}</p>
            <label>Subject · EN<input value={englishSubject} maxLength={180} disabled={saved||busy} onChange={e=>{setEnglishSubject(e.target.value);setPreview(null);}}/></label>
            <label>Preheader · EN<input value={englishPreheader} disabled={saved||busy} maxLength={130} onChange={e=>setEnglishPreheader(e.target.value)}/></label>
            <MailRichText formatLabel="Formatting · EN" label="Message · EN" value={englishMessage} onChange={setEnglishMessage} onFormat={()=>setFormatted(x=>!x)} enabled={formatted} disabled={saved||busy}/>
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
          <label>{t('Acțiune predefinită','Button action')}
            <FilterSelect value="" disabled={saved||busy} onChange={event=>{
              const path=event.target.value;if(!path)return;
              setCtaPath(path);
              const labels:Record<string,[string,string]>={'/cont':['Deschide aplicația AutoCare','Open the AutoCare app'],
                '/cont?tab=Documente':['Deschide Documente','Open Documents'],'/cont?tab=Întreținere':['Deschide Întreținere','Open Maintenance'],
                '/cont?tab=Centru+de+suport':['Deschide Suport','Open Support']};
              const pair=labels[path];if(!pair)return;
              setCtaLabel(pair[0]);setEnglishCta(pair[1]);
              const translation=englishEmailCopy[template];
              if(translation){setEnglishSubject(value=>value||translation.subject||'AutoCare — '+translation.title);setEnglishMessage(value=>value||translation.body);}
            }}>
              <option value="">{t('Alege destinația','Choose a destination')}</option>
              <option value="/cont">{t('Deschide aplicația AutoCare','Open the AutoCare app')}</option>
              <option value="/cont?tab=Documente">{t('Deschide Documente','Open Documents')}</option>
              <option value="/cont?tab=Întreținere">{t('Deschide Întreținere','Open Maintenance')}</option>
              <option value="/cont?tab=Centru+de+suport">{t('Deschide Suport','Open Support')}</option>
            </FilterSelect>
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
          </div>
          <div className="studio-fields" hidden={section!=='audiences'&&step!==1}>
          <label>{t('Destinatari','Recipients')}
            <FilterSelect disabled={busy||saved} value={segment} onChange={event=>{setSegment(event.target.value as typeof segment);setSegmentCount(null);}}>
              <option value="">{t('Alegere individuală','Individual selection')}</option>
              <option value="all">{t('Toți utilizatorii eligibili','All eligible users')}</option>
              <option value="garage">{t('Conturi cu vehicule active','Accounts with active vehicles')}</option>
              <option value="no_garage">{t('Conturi fără vehicule active','Accounts without active vehicles')}</option>
            </FilterSelect>
          </label>
          {segment && <div className="inline"><button type="button" disabled={busy||saved} onClick={()=>void run(async()=>{
            const result=await api('/audience','POST',{segment,template,category});setSegmentCount(result.count);
          })}>{t('Calculează destinatarii eligibili','Count eligible recipients')}</button>
            {segmentCount!==null&&<span role="status">{segmentCount} {t('eligibili','eligible')}</span>}</div>}
          {!segment && <>
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
          </>}
          </div>
          {section==='compose'&&step===3&&<p>{t('Verifică subiectul, conținutul și linkurile în ambele limbi folosind panoul de previzualizare.','Review the subject, content and links in both languages using the preview panel.')}</p>}
          <div className="studio-fields" hidden={section!=='compose'||step!==4}>
            <button type="button" onClick={()=>setSection('settings')}><Settings2 size={16}/>{t('Conectare și test Gmail','Gmail connection and test')}</button>
          <button type="button" disabled={!canDraft||saved} onClick={()=>void run(async()=>{
            await api('/campaigns','POST',draft);setSaved(true);setData(await api());setNotice(t('Ciornă salvată.','Draft saved.'));
          })}>{t('Salvează ciorna','Save draft')}</button>
          {data.permissions.canApprove && template!=='release_news' && <div className="inline">
            <label>{t('Data și ora locală a expedierii','Local scheduled delivery time')}<input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/></label>
            <button type="button" disabled={!canDraft||!scheduledAt} onClick={()=>void run(async()=>{
              if (!await requestConfirmation(t('Aprobi și programezi expedierea acestei campanii?','Approve and schedule delivery for this campaign?'))) return;
              if(!saved){await api('/campaigns','POST',draft);setSaved(true);}
              await api(`/campaigns/${draftId}/schedule`,'POST',{at:new Date(scheduledAt).toISOString()});
              setData(await api());setSection('history');
            })}>{t('Aprobă și programează','Approve and schedule')}</button>
          </div>}
          {template==='release_news' && <label>{t('Mod de expediere','Delivery mode')}
            <FilterSelect value={releaseMode} onChange={e=>setReleaseMode(e.target.value==='auto'?'auto':'approval')}>
              <option value="approval">{t('Aprobare după publicare','Approval after publication')}</option>
              {(androidRelease ? data.lifecycle.configuration.autoAndroid : data.lifecycle.configuration.autoWeb) &&
                <option value="auto">{t('Automat după validarea publicării','Automatic after publication check')}</option>}
            </FilterSelect>
          </label>}
          <button
            type="button"
            className="studio-primary"
            disabled={!canDraft || !preview || !!previewError || (data.permissions.canApprove && !gmailStatus?.availableHere)}
            onClick={() => {
              if (!canDraft) return;
              void run(async () => {
              if (data.permissions.canApprove && !await requestConfirmation(t('Aprobi expedierea acestei comunicări către destinatarii eligibili?','Approve delivery to the eligible recipients?'))) return;
              if (data.permissions.canApprove && (!gmailStatus?.connected||!gmailStatus.testedAt||gmailStatus.reconnectRequired||!gmailStatus.availableHere))
                throw new Error(t('Conectează Gmail și rulează testul din Mail Center.','Connect Gmail and run the Mail Center test.'));
              if (!saved) {
                await api('/campaigns', 'POST', draft);
                setSaved(true);
              }
              if (!data.permissions.canApprove && !data.reviews.some(x => x.campaignId === draftId && x.status === 'approved')) {
                await api(`/campaigns/${draftId}/request-approval`, 'POST');
                setData(await api()); setNotice('Cererea apare în Mail Center-ul Fondatorului. Nu s-au trimis emailuri.'); setSection('history'); return;
              }
              if (template === 'release_news') {
                if (!data.permissions.canApprove) throw new Error('Doar Fondatorul poate publica o lansare.');
                await api(`/campaigns/${draftId}/publish-release`, 'POST', { version:releaseVersion,releaseDate,mode:releaseMode,proof:{
                  commit:releaseCommit,testsPassed:releaseTests,
                  ...(androidRelease?{android:{version:androidVersion,sha256:androidHash,signatureVerified:androidSignature}}:{}),
                } });
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
            <Send size={17} /> {busy ? 'Se procesează…' : !data.permissions.canApprove && !data.reviews.some(x => x.campaignId === draftId && x.status === 'approved') ? 'Trimite Fondatorului pentru aprobare' : template === 'release_news' ? 'Programează AutoCare News' : saved ? 'Continuă trimiterea emailurilor' : hasAudience ? `Trimite emailul către ${segment?segmentCount:recipients.length} destinatari` : 'Bifează un destinatar pentru trimitere'}
          </button>
          {!hasAudience && <p className="small muted">Bifează cel puțin un destinatar pentru a activa trimiterea.</p>}
          {data.permissions.directSend && gmailStatus && !gmailStatus.testedAt && (
            <p className="small muted">{t('Rulează testul Gmail înainte de prima expediere.','Run the Gmail test before the first delivery.')}</p>
          )}
          </div>
          {section==='compose'&&step<4&&<footer className="studio-editor-footer">
            <button type="button" onClick={()=>setStep(step-1)}>{t('Înapoi','Back')}</button>
            <button type="button" className="studio-primary" onClick={()=>setStep(step+1)}>{t('Continuă','Continue')}<ArrowRight size={16}/></button>
          </footer>}
        </section>
        <section className="studio-surface mail-preview" hidden={section!=='compose'}>
          <header className="studio-section-heading"><div><h2>{t('Previzualizare live','Live preview')}</h2><p>{preview?.subject||t('Se pregătește previzualizarea…','Preparing preview…')}</p></div><Eye size={20}/></header>
          <div className="studio-preview-controls">
            {(['ro','en'] as const).map(id=><button type="button" key={id} aria-pressed={previewLanguage===id} onClick={()=>setPreviewLanguage(id)}>{id.toUpperCase()}</button>)}
            {(['desktop','mobile'] as const).map(id=><button type="button" key={id} aria-pressed={width===id} onClick={()=>setWidth(id)}>{id==='desktop'?'Desktop':t('Mobil','Mobile')}</button>)}
            {(['light','dark'] as const).map(id=><button type="button" key={id} aria-pressed={theme===id} onClick={()=>setTheme(id)}>{id==='light'?t('Luminos','Light'):t('Întunecat','Dark')}</button>)}
          </div>
          {previewError&&<p className="error" role="alert">{previewError}</p>}
          {preview&&<div className="studio-preview-canvas" data-theme={theme}>
            <iframe className={width==='mobile'?'studio-preview-mobile':''} title={t('Previzualizare email AutoCare','AutoCare email preview')} sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html}/>
          </div>}
          {preview&&<details><summary>{t('Versiune text simplu','Plain text version')}</summary><pre>{preview.text}</pre></details>}
        </section>
      </div>
      <section className="studio-surface stack mail-automation-card" hidden={section !== 'automation'}>
        <h2>{t('Automatizări','Automations')}</h2>
        <div className="mail-lifecycle-intro">
          <p>{t('Evenimentele eligibile intră în coadă. Procesarea programată funcționează și când nu ești conectat.','Eligible events enter a queue. Scheduled processing runs even when you are signed out.')}</p>
          <p className="mail-status">{data.automation.enabled && gmailStatus?.connected && gmailStatus.testedAt && !gmailStatus.reconnectRequired
            ? t('Automatizări Gmail autorizate','Gmail automations authorized')
            : t('Automatizările Gmail așteaptă configurarea sau autorizarea','Gmail automations await setup or authorization')}</p>
          <p>{t('Ultimul job de remindere','Last reminder job')}{' · '}{data.lifecycle.lastJob ? new Date(data.lifecycle.lastJob).toLocaleString(locale) : t('Fără execuții înregistrate','No recorded runs')}</p>
        </div>
        {data.permissions.canApprove && <fieldset className="mail-lifecycle-row">
          <legend>{t('Expediere automată după publicare','Automatic delivery after publication')}</legend>
          {(['autoWeb','autoAndroid'] as const).map(key=><label key={key}>
            <input type="checkbox" disabled={busy} checked={data.lifecycle.configuration[key]} onChange={e=>{
              const checked=e.target.checked;
              void run(async()=>{
                if (checked && !await requestConfirmation(t('Permiți trimiterea automată a anunțurilor pregătite după ce versiunea este disponibilă?','Allow queued announcements to send automatically once the release is live?'))) return;
                await api('/lifecycle','PUT',{...data.lifecycle.configuration,[key]:checked});
                setData(await api());
              });
            }} />{key==='autoWeb'?'Web':'Android'}
          </label>)}
        </fieldset>}
        <div className="mail-lifecycle-filters">
          <label>{t('Caută','Search')}<input type="search" value={automationQuery} onChange={e=>setAutomationQuery(e.target.value)} /></label>
          <label>{t('Configurare','Configuration')}<FilterSelect value={automationFilter} onChange={e=>setAutomationFilter(e.target.value)}>
            <option value="all">{t('Toate','All')}</option><option value="on">{t('Permise','Allowed')}</option><option value="off">{t('Oprite','Paused')}</option>
          </FilterSelect></label>
          <label>{t('Rezultat','Result')}<FilterSelect value={automationResult} onChange={e=>setAutomationResult(e.target.value)}>
            <option value="any">{t('Toate','All')}</option><option value="pending">{t('În coadă','Queued')}</option><option value="delivered">{t('Livrare confirmată','Confirmed delivery')}</option><option value="failed">{t('Eșecuri','Failures')}</option>
          </FilterSelect></label>
        </div>
        <div className="mail-lifecycle-grid">
          {lifecycleRows.filter(([key,ro,english,triggerRo,triggerEn])=>{
            const config=data.lifecycle.configuration[key];
            const stats=data.lifecycle.stats[key];
            return (!automationQuery.trim() || t(ro+' '+triggerRo,english+' '+triggerEn).toLocaleLowerCase(locale).includes(automationQuery.trim().toLocaleLowerCase(locale))) &&
              (automationFilter==='all' || config===(automationFilter==='on')) &&
              (automationResult==='any' || (automationResult==='pending' ? stats.pending : automationResult==='delivered' ? stats.delivered : stats.failed)>0);
          }).map(row=>{
            const [key,ro,english,triggerRo,triggerEn,associated]=row;
            const stats=data.lifecycle.stats[key], configured=data.lifecycle.configuration[key];
            return <article className="mail-lifecycle-item" key={key}>
              <div className="mail-lifecycle-row"><Mail size={20} aria-hidden="true"/><h3>{t(ro,english)}</h3><span>{configured?t('Permis','Allowed'):t('Oprit','Paused')}</span></div>
              <p>{t(triggerRo,triggerEn)}</p>
              <dl><div><dt>{t('În coadă','Queued')}</dt><dd>{stats.pending}</dd></div><div><dt>{t('Acceptate','Accepted')}</dt><dd>{stats.accepted}</dd></div><div><dt>{t('Livrate','Delivered')}</dt><dd>{stats.delivered}</dd></div><div><dt>{t('Erori','Errors')}</dt><dd>{stats.failed}</dd></div></dl>
              <p className="small muted">{t('Ultima încercare','Last attempt')}{' · '}{stats.lastAttempt ? new Date(stats.lastAttempt).toLocaleString(locale) : '—'}</p>
              <div className="mail-lifecycle-row">
                <button type="button" disabled={busy} onClick={()=>void run(async()=>{
                  setAutomationExample(row);
                  setAutomationPreview(await api('/preview','POST',{template:associated,language:previewLanguage}));
                })}>{t('Previzualizează','Preview')}</button>
                {data.permissions.canApprove && <button type="button" disabled={busy} onClick={()=>void run(async()=>{
                  await api('/lifecycle','PUT',{...data.lifecycle.configuration,[key]:!configured});
                  setData(await api());
                })}>{configured?t('Oprește','Pause'):t('Permite','Allow')}</button>}
              </div>
            </article>;
          })}
          {automationFilter!=='on' && automationResult==='any' && !automationQuery.trim() && <article className="mail-lifecycle-item">
            <h3>{t('Mentenanță și reactivare','Maintenance and re-engagement')}</h3>
            <p>{t('Oprite. Comunicările de mentenanță pot fi pregătite manual.','Inactive. Maintenance announcements can be prepared manually.')}</p>
          </article>}
        </div>
        {automationExample && automationPreview && <div className="mail-lifecycle-example">
          <div className="mail-lifecycle-row">
            <h3>{t(automationExample[1],automationExample[2])}</h3>
            {(['ro','en'] as const).map(lang=><button key={lang} type="button" aria-pressed={previewLanguage===lang} disabled={busy} onClick={()=>void run(async()=>{
              setPreviewLanguage(lang);
              setAutomationPreview(await api('/preview','POST',{template:automationExample[5],language:lang}));
            })}>{lang.toUpperCase()}</button>)}
            <button type="button" onClick={()=>setAutomationExample(null)}>{t('Închide','Close')}</button>
          </div>
          <iframe title={t('Previzualizare email','Email preview')} sandbox="" srcDoc={automationPreview.html} />
        </div>}
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
      <section className="studio-surface" hidden={!(['history','campaigns','scheduled'] as StudioSection[]).includes(section)}>
        <div className="inline">
          <h2>{section==='scheduled'?t('Emailuri programate','Scheduled emails'):section==='campaigns'?t('Campanii','Campaigns'):t('Istoric și aprobări','History & approvals')}</h2>
          <button disabled={busy} onClick={() => void run(async () => setData(await api()))}>
            <RefreshCw size={16} />
            Reîncarcă
          </button>
        </div>
        <dl className="studio-metrics" hidden={section!=='history'}>
          {([['accepted',t('Acceptate','Accepted')],['delivered',t('Livrate confirmat','Confirmed delivered')],['failed',t('Eșuate sau incerte','Failed or unconfirmed')],['bounces','Bounce'],['unsubscribed',t('Dezabonări','Unsubscribes')]] as const).map(([key,label])=>
            <div key={key}><dt>{label}</dt><dd>{data.stats[key]}</dd></div>)}
        </dl>
        {section==='history' && data.reviews.length > 0 && <div className="mail-review-list"><h3>Aprobări comunicări</h3>{data.reviews.map(review => <div className="mail-review-item" key={review.campaignId}>
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
        <div className="mail-history-filters form-grid">
          <label>{t('Caută în comunicări','Search communications')}<input type="search" maxLength={120} value={historyQuery} onChange={event=>setHistoryQuery(event.target.value)} /></label>
          <label>{t('Status','Status')}<FilterSelect value={historyStatus} onChange={event=>setHistoryStatus(event.target.value)}><option value="">{t('Toate statusurile','All statuses')}</option>{Object.entries(labels).map(([key,label])=><option value={key} key={key}>{en?key:label}</option>)}</FilterSelect></label>
          <label>{t('Sursa','Source')}<FilterSelect value={historySource} onChange={event=>setHistorySource(event.target.value)}><option value="">{t('Toate sursele','All sources')}</option><option value="manual">{t('Manual','Manual')}</option><option value="automation">{t('Automatizare','Automation')}</option></FilterSelect></label>
          <label>{t('Categorie','Category')}<FilterSelect value={historyCategory} onChange={event=>setHistoryCategory(event.target.value)}><option value="">{t('Toate categoriile','All categories')}</option><option value="transactional">{t('Tranzacțional','Transactional')}</option><option value="promotional">{t('Promoțional','Promotional')}</option></FilterSelect></label>
          <label>{t('De la data','Created on or after')}<PremiumDateInput value={historyDate} onChange={event=>setHistoryDate(event.target.value)} /></label>
          <label>{t('Până la data','Through date')}<PremiumDateInput value={historyEnd} onChange={event=>setHistoryEnd(event.target.value)}/></label>
          <label>{t('Subiect tematic','Topic')}<FilterSelect value={historyTopic} onChange={event=>setHistoryTopic(event.target.value)}><option value="">{t('Toate subiectele','All topics')}</option>{mailTopics.map(item=><option key={item.id} value={item.id}>{en?item.en:item.ro}</option>)}</FilterSelect></label>
          <label>{t('Șablon','Template')}<FilterSelect value={historyTemplate} onChange={event=>setHistoryTemplate(event.target.value)}><option value="">{t('Toate șabloanele','All templates')}</option>{Object.entries(data.templates).map(([id,entry])=><option key={id} value={id}>{en?(englishEmailCopy[id]?.title??entry.label):entry.label}</option>)}</FilterSelect></label>
          <button type="button" onClick={()=>{setHistoryQuery('');setHistoryStatus('');setHistorySource('');setHistoryCategory('');setHistoryDate('');setHistoryEnd('');setHistoryTopic('');setHistoryTemplate('');}}>{t('Resetează filtrele','Clear filters')}</button>
          <p role="status">{history.length} {t('comunicări găsite în istoricul încărcat','communications found in loaded history')}</p>
        </div>
        {!history.length && <p role="status">{t('Nu există comunicări pentru aceste filtre.','No communications match these filters.')}</p>}
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
              {history.map((c) => (
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
                    <strong>{labels[c.status]||c.status}</strong>
                    {c.scheduledAt && <div>{new Date(c.scheduledAt).toLocaleString(locale)}</div>}
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
                            setEnglishSubject(result.englishContent?.subject??'');setEnglishMessage(result.englishContent?.message??'');setEnglishCta(result.englishContent?.ctaLabel??'');
                            setStyle(result.design?.style??'signature');setPreheader(result.design?.preheader??'');setEnglishPreheader(result.design?.englishPreheader??'');setFormatted(result.design?.formatted??false);
                            setStep(4);
                            setCommunicationType(result.communicationType);setTemplateLabel(result.templateLabel);setCategoryLabel(result.categoryLabel);
                            setSaved(true);
                            setConfirmed(false);
                            setPreview(null);
                            setSegment('');setSegmentCount(null);
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
            {detail.campaign.id===draftId && detail.campaign.source==='manual' && ['draft','sending'].includes(detail.campaign.status) &&
              <button type="button" onClick={()=>{setSection('compose');setStep(4);}}>{t('Vezi redactarea și trimiterea','Open composer and sending')}</button>}<p>{detail.communicationType}</p><p style={{whiteSpace: 'pre-wrap'}}>{detail.campaign.message}</p><p>{detail.campaign.ctaLabel} · {detail.campaign.ctaPath}</p>
            {data.permissions.canApprove && ['draft','scheduled','sending','held'].includes(detail.campaign.status) &&
              (detail.campaign.source==='manual'||detail.campaign.template==='release_news') &&
              <button disabled={busy} type="button" onClick={()=>void run(async()=>{
                if(!await requestConfirmation(t('Anulezi mesajele încă neexpediate?','Cancel messages that have not been sent?'))) return;
                await api(`/campaigns/${detail.campaign.id}/cancel`,'POST');setDetail(await api(`/campaigns/${detail.campaign.id}`));setData(await api());
              })}>{t('Anulează campania','Cancel campaign')}</button>}
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
