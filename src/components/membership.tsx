'use client';
import PremiumSales from './premium-sales';
import PremiumCareTools from './premium-care-tools';
import PremiumDownloads from './premium-downloads';
import PremiumOverview from './premium-overview';
import PremiumWorkspace from './premium-workspace';
import './membership-premium.css';
import { useApplicationLocale } from './application-locale';
import { Check, ArrowUpRight, CreditCard, ShieldCheck } from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { localDate } from '@/lib/config';
import { savings } from '@/lib/pricing-display';
type Data = Awaited<ReturnType<typeof dashboard>>;
const amount = (b: number) =>
  new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(b / 100);
export function PriceCards({
  monthlyBani,
  annualBani,
  checkout,
  busy = false,
  prepaid = false,
  language = 'ro',
  reportTimezone,
  selectedPlan,
}: {
  monthlyBani: number;
  annualBani: number;
  checkout?: (interval: string) => void;
  busy?: boolean;
  prepaid?: boolean;
  language?: 'ro' | 'en';
  reportTimezone?: string;
  selectedPlan?: string;
}) {
  const locale = useApplicationLocale();
  const s = savings(monthlyBani, annualBani);
  const en = language === 'en';
  const euro = (b: number) =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(b / 500);
  const price = (b: number) => (en ? euro(b) : amount(b));
  const to = reportTimezone ? localDate(new Date(), reportTimezone) : '';
  function reportLink(months: number, kind: 'service' | 'expense' | '', format: 'pdf' | 'csv') {
    const [year, month] = to.split('-').map(Number);
    const from = new Date(Date.UTC(year, month - months, 1)).toISOString().slice(0, 10);
    return '/api/v1/export?' + new URLSearchParams({ format, archived: 'active', from, to, ...(kind && { kind }) });
  }
  return (
    <div className="subscription-options ac-plan-grid">
      <article className="card subscription-option ac-plan-card" data-selected={selectedPlan === "monthly" || undefined}>
        <div className="subscription-symbol">
          <CreditCard size={23} />
        </div>
        <p className="eyebrow">{en?'MONTHLY PREMIUM':'PREMIUM LUNAR'}</p>
        <h2>{en?'Flexible, month to month.':'Control, lună de lună.'}</h2>
        <div className="subscription-price">
          {price(monthlyBani)} <span>{en ? '/month' : 'lei/lună'}</span>
        </div>
        <p className="small muted">
          {en
            ? `${euro(s.annualMonthlyBani)} for 12 monthly payments.`
            : `${amount(s.annualMonthlyBani)} lei pentru 12 luni de plată lunară.`}
        </p>
        <ul>
          <li><Check size={15} />{en ? 'AutoCare AI for every vehicle' : 'AutoCare AI pentru fiecare vehicul'}</li>
          <li><Check size={15} />{en ? '120 AI questions and 6 scans per day' : '120 întrebări AI și 6 scanări pe zi'}</li>
          <li>
            <Check size={15} />
            {en
              ? 'Maintenance planning and mileage estimates'
              : 'Revizii planificate după timp și kilometraj'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Expense analysis and history exports'
              : 'Cheltuieli, bugete și rapoarte PDF/CSV'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Configurable reminder preferences'
              : 'Mementouri pentru documente și întreținere'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Priorities from saved deadlines and mileage'
              : 'Istoric separat pentru fiecare vehicul'}
          </li>

          <li>
            <Check size={15} /> {prepaid?(en?'One-time extension payment':'Prelungire cu plată unică'):(en?'Monthly recurring billing':'Facturare recurentă lunară')}
          </li>
          <li>
            <Check size={15} /> {en?'Manage in the billing portal':'Gestionare din portalul de facturare'}
          </li>
        </ul>
        <div className="ac-plan-report">
          <span>{en ? 'QUICK REPORT' : 'RAPORT RAPID'}</span>
          {reportTimezone ? <a href={reportLink(1, 'service', 'pdf')}>{en ? 'Monthly service PDF' : 'Fișa de revizii a lunii'} <ArrowUpRight size={14}/></a> : <strong>{en ? 'Monthly service PDF' : 'Fișa de revizii a lunii'}</strong>}
        </div>
        {checkout ? (
          <button className="button" disabled={busy} onClick={() => checkout('monthly')}>
            {prepaid?(en?'Add 1 month':'Adaugă 1 lună'):(en?'Choose monthly':'Alege lunar')} <ArrowUpRight size={15} />
          </button>
        ) : (
          <a className="button" href="/inregistrare?next=%2Fcont%3Ftab%3DAbonament%26plan%3Dmonthly">
            {en?'Create account and choose plan':'Creează cont și alege planul'} <ArrowUpRight size={15} />
          </a>
        )}
      </article>
      <article className="card subscription-option ac-plan-card" data-selected={selectedPlan === "quarterly" || undefined}>
        <div className="subscription-symbol">
          <CreditCard size={23} />
        </div>
        <p className="eyebrow">{en?'3-MONTH PREMIUM':'PREMIUM 3 LUNI'}</p>
        <h2>{en?'Three months of peace of mind.':'Trei luni de organizare.'}</h2>
        <div className="subscription-price">
          {price(monthlyBani * 3)} <span>{en ? '/3 months' : 'lei / 3 luni'}</span>
        </div>
        <p className="small muted">
          {prepaid ? (en?'One payment for 3 additional months.':'O singură plată pentru încă 3 luni.') : en
            ? `Equivalent to ${euro(monthlyBani)}/month, billed every 3 months.`
            : `Echivalent cu ${amount(monthlyBani)} lei/lună, facturat la fiecare 3 luni.`}
        </p>
        <ul>
          <li><Check size={15} />{en ? 'AutoCare AI for every vehicle' : 'AutoCare AI pentru fiecare vehicul'}</li>
          <li><Check size={15} />{en ? '120 AI questions and 6 scans per day' : '120 întrebări AI și 6 scanări pe zi'}</li>
          <li>
            <Check size={15} />
            {en
              ? 'Maintenance planning and mileage estimates'
              : 'Revizii planificate după timp și kilometraj'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Expense analysis and history exports'
              : 'Cheltuieli, bugete și rapoarte PDF/CSV'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Configurable reminder preferences'
              : 'Mementouri pentru documente și întreținere'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Priorities from saved deadlines and mileage'
              : 'Istoric separat pentru fiecare vehicul'}
          </li>

          <li>
            <Check size={15} /> {prepaid?(en?'One-time extension payment':'Prelungire cu plată unică'):(en?'Recurring billing every 3 months':'Facturare recurentă la 3 luni')}
          </li>
          <li>
            <Check size={15} /> {en?'Manage in the billing portal':'Gestionare din portalul de facturare'}
          </li>
        </ul>
        <div className="ac-plan-report">
          <span>{en ? 'QUICK REPORT' : 'RAPORT RAPID'}</span>
          {reportTimezone ? <a href={reportLink(3, 'expense', 'csv')}>{en ? 'Three-month expense CSV' : 'Cheltuieli pe 3 luni'} <ArrowUpRight size={14}/></a> : <strong>{en ? 'Three-month expense CSV' : 'Cheltuieli pe 3 luni'}</strong>}
        </div>
        {checkout ? (
          <button className="button" disabled={busy} onClick={() => checkout('quarterly')}>
            {prepaid?(en?'Add 3 months':'Adaugă 3 luni'):(en?'Choose 3 months':'Alege 3 luni')} <ArrowUpRight size={15} />
          </button>
        ) : (
          <a className="button" href="/inregistrare?next=%2Fcont%3Ftab%3DAbonament%26plan%3Dquarterly">
            {en?'Create account and choose plan':'Creează cont și alege planul'} <ArrowUpRight size={15} />
          </a>
        )}
      </article>
      <article className="card subscription-option annual-option ac-plan-card" data-selected={selectedPlan === "annual" || undefined}>
        <span className="best-plan">{en?'BEST VALUE':'CEL MAI BUN RAPORT PREȚ–BENEFICII'}</span>
        <div className="subscription-symbol">
          <ShieldCheck size={23} />
        </div>
        <p className="eyebrow">{en?'ANNUAL PREMIUM':'PREMIUM ANUAL'}</p>
        <h2>{en?'More value.':'Un an pentru garajul tău.'}</h2>
        <div className="subscription-price">
          {price(annualBani)} <span>{en ? '/year' : 'lei/an'}</span>
        </div>
        <p className="subscription-saving">
          {s.savingBani > 0 ? (
            <>
              {en
                ? `Save ${euro(s.savingBani)}/year`
                : `Economisești ${amount(s.savingBani)} lei/an`}{' '}
              · {s.savingPercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%
            </>
          ) : en ? (
            'One annual payment.'
          ) : (
            'Plată anuală într-o singură tranșă.'
          )}
        </p>
        <ul>
          <li><Check size={15} />{en ? 'AutoCare AI for every vehicle' : 'AutoCare AI pentru fiecare vehicul'}</li>
          <li><Check size={15} />{en ? '120 AI questions and 6 scans per day' : '120 întrebări AI și 6 scanări pe zi'}</li>
          <li>
            <Check size={15} />
            {en
              ? 'Maintenance planning and mileage estimates'
              : 'Revizii planificate după timp și kilometraj'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Expense analysis and history exports'
              : 'Cheltuieli, bugete și rapoarte PDF/CSV'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Configurable reminder preferences'
              : 'Mementouri pentru documente și întreținere'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Priorities from saved deadlines and mileage'
              : 'Istoric separat pentru fiecare vehicul'}
          </li>

          <li>
            <Check size={15} /> {prepaid?(en?'One-time extension payment':'Prelungire cu plată unică'):(en?'Annual recurring billing':'Facturare recurentă anuală')}
          </li>
          <li>
            <Check size={15} />{' '}
            {s.savingBani>0?(en?'Lower cost than 12 monthly payments':'Cost mai mic față de 12 plăți lunare'):(en?'One payment per year':'O singură plată pe an')}
          </li>
        </ul>
        <div className="ac-plan-report">
          <span>{en ? 'QUICK REPORT' : 'RAPORT RAPID'}</span>
          {reportTimezone ? <a href={reportLink(12, '', 'pdf')}>{en ? '12-month garage PDF' : 'Dosarul garajului pe 12 luni'} <ArrowUpRight size={14}/></a> : <strong>{en ? '12-month garage PDF' : 'Dosarul garajului pe 12 luni'}</strong>}
        </div>
        {checkout ? (
          <button className="primary" disabled={busy} onClick={() => checkout('annual')}>
            {prepaid?(en?'Add 12 months':'Adaugă 12 luni'):(en?'Choose annual':'Alege anual')} <ArrowUpRight size={15} />
          </button>
        ) : (
          <a className="button primary" href="/inregistrare?next=%2Fcont%3Ftab%3DAbonament%26plan%3Dannual">
            {en?'Create account and choose plan':'Creează cont și alege planul'} <ArrowUpRight size={15} />
          </a>
        )}
      </article>
    </div>
  );
}
export default function Membership({
  language = 'ro',
  data,
  busy,
  checkout: _checkout,
  portal: _portal,
  invoices: _invoices,
  navigate,
  onRecord,
  preview = false,
}: {
  language?: 'ro' | 'en';
  data: Data;
  preview?: boolean;
  navigate: (tab: string) => void;
  onRecord: (record: Data['records'][number]) => void;
  busy: boolean;
  checkout: (interval: string) => void;
  portal: () => void;
  invoices: Array<{
    id: string;
    createdAt: string;
    amountBani: number;
    currency: string;
    status: string;
    livemode?: boolean;
  }>;
}) {
  const locale = useApplicationLocale();
  const accessUntil=Math.max(new Date(data.premiumAccess.paidUntil||0).getTime(),...data.premiumAccess.manual.map(g=>g.expiresAt?new Date(g.expiresAt).getTime():0));
  return (
    <div className="membership-workspace studio-membership">
      <section className="studio-premium-offer" data-workspace-ui><div><span className="studio-kicker">AUTOCARE PREMIUM</span><h2>{language==='en'?'Your garage. The complete picture.':'Garajul tău. Imaginea completă.'}</h2><p>{language==='en'?'More vehicles, advanced maintenance and reports. All in one place.':'Mai multe mașini, întreținere avansată și rapoarte. Totul într-un singur loc.'}</p><div className="studio-benefit-chips"><span><Check size={17}/>{language==='en'?'Multiple vehicles':'Mai multe mașini'}</span><span><Check size={17}/>PDF / CSV</span><span><Check size={17}/>{language==='en'?'Maintenance forecasts':'Estimări de întreținere'}</span></div></div><div className="studio-offer-price"><span>{language==='en'?'MONTHLY PLAN':'PLAN LUNAR'}</span><strong>{new Intl.NumberFormat(locale,{style:'currency',currency:'RON',maximumFractionDigits:0}).format(data.pricing.monthlyBani/100)}<small>{language==='en'?'/ month':'/ lună'}</small></strong><button className="primary" type="button" onClick={()=>navigate('Abonament')}>{data.premium?(language==='en'?'Manage subscription':'Gestionează abonamentul'):(language==='en'?'Choose Premium':'Alege Premium')}<ArrowUpRight size={18}/></button><small>{language==='en'?'Final conditions shown before payment.':'Condițiile finale sunt afișate înainte de plată.'}</small></div></section>
      <section className="card membership-current">
        <div className="settings-section-title">
          <span className="list-icon">
            <ShieldCheck size={24} />
          </span>
          <div>
            <p className="eyebrow">
              {language === 'en' ? 'YOUR CURRENT ACCESS' : 'ACCESUL TĂU ACTUAL'}
            </p>
            <h2>
              {data.premium ? 'AutoCare Premium' : language === 'en' ? 'Free plan' : 'Plan gratuit'}
            </h2>
          </div>
        </div>
        <div className="membership-access">
          <div>
            <span className="small muted">Sursa accesului</span>
            <strong>
              {data.premiumAccess.paid
                ? 'Abonament plătit confirmat'
                : data.premiumAccess.manual.length
                  ? 'Acces acordat de Fondator'
                  : 'Plan gratuit'}
            </strong>
            {data.premiumAccess.paid && data.premiumAccess.manual.length > 0 && (
              <p className="micro">Există și acces manual activ, separat de abonamentul plătit.</p>
            )}
          </div>
          <div>
            <span className="small muted">Valabilitate</span>
            <strong>
              {data.premiumAccess.manual.some((g) => !g.expiresAt)
                ? 'Acces manual fără expirare'
                : accessUntil>Date.now()?new Date(accessUntil).toLocaleDateString(locale):'Fără abonament activ'}
            </strong>
          </div>
          <div>
            <span className="small muted">Garaj</span>
            <strong data-workspace-ui>
              {data.vehicles.filter((v) => !v.archived).length}{' '}
              {language === 'en'
                ? data.vehicles.filter((v) => !v.archived).length === 1
                  ? 'active vehicle'
                  : 'active vehicles'
                : data.vehicles.filter((v) => !v.archived).length === 1
                  ? 'mașină activă'
                  : 'mașini active'}
            </strong>
          </div>
        </div>
        {data.subscription?.customerId && (
          <button disabled={busy} onClick={()=>navigate('Abonament')}>
            Gestionează facturarea <ArrowUpRight size={14} />
          </button>
        )}
      </section>
      {data.premium && <nav aria-label={language==='en'?'Premium shortcuts':'Acces rapid Premium'} data-workspace-ui className="card" style={{display:'flex',gap:12,flexWrap:'wrap',padding:16}}><a className="button" href="#premium-budgets">{language==='en'?'Maintenance budgets':'Bugetele lucrărilor'}</a><a className="button" href="#premium-mechanic-folder">{language==='en'?'Mechanic folder':'Dosar pentru mecanic'}</a><a className="button" href="#premium-reports">{language==='en'?'PDF and CSV reports':'Rapoarte PDF și CSV'}</a></nav>}
      {data.premium ? (
        <PremiumOverview data={data} language={language} preview={preview} navigate={navigate} />
      ) : (
        <PremiumSales language={language} attachmentLimit={data.planLimits.attachments} onChoosePlan={() => navigate('Abonament')} />
      )}
      <PremiumWorkspace data={data} language={language} navigate={navigate} onRecord={onRecord} />
      {data.premium && <PremiumCareTools data={data} language={language} preview={preview} onRecord={onRecord}/> }
      {data.premium && <div id="premium-reports" style={{scrollMarginTop:90}}><PremiumDownloads data={data} language={language} preview={preview} /></div>}
      <section className="card" id="premium-plans" data-workspace-ui><h3>{language==='en'?'Subscription and renewal':'Abonament și prelungire'}</h3><p>{language==='en'?'Manage your paid period, plans and invoices on the dedicated subscription page.':'Gestionează perioada achitată, planurile și facturile pe pagina separată de abonament.'}</p><button type="button" onClick={()=>navigate('Abonament')}>{language==='en'?'Open subscription':'Deschide abonamentul'}</button></section>
    </div>
  );
}
