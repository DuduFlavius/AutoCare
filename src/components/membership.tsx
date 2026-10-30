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
}: {
  monthlyBani: number;
  annualBani: number;
  checkout?: (interval: string) => void;
  busy?: boolean;
  prepaid?: boolean;
  language?: 'ro' | 'en';
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
  return (
    <div className="subscription-options ac-plan-grid">
      <article className="card subscription-option ac-plan-card">
        <div className="subscription-symbol">
          <CreditCard size={23} />
        </div>
        <p className="eyebrow">PREMIUM LUNAR</p>
        <h2>Flexibil, lună de lună.</h2>
        <div className="subscription-price">
          {price(monthlyBani)} <span>{en ? '/month' : 'lei/lună'}</span>
        </div>
        <p className="small muted">
          {en
            ? `${euro(s.annualMonthlyBani)} for 12 monthly payments.`
            : `${amount(s.annualMonthlyBani)} lei pentru 12 luni de plată lunară.`}
        </p>
        <ul>
          <li>
            <Check size={15} />
            {en
              ? 'Maintenance planning and mileage estimates'
              : 'Planificare întreținere și estimări după kilometraj'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Expense analysis and history exports'
              : 'Analiza cheltuielilor și exporturi din istoric'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Configurable reminder preferences'
              : 'Preferințe configurabile pentru mementouri'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Priorities from saved deadlines and mileage'
              : 'Priorități după termene și kilometraj'}
          </li>

          <li>
            <Check size={15} /> {prepaid?(en?'One-time extension payment':'Prelungire cu plată unică'):(en?'Monthly recurring billing':'Facturare recurentă lunară')}
          </li>
          <li>
            <Check size={15} /> Gestionare din portalul de facturare
          </li>
        </ul>
        {checkout ? (
          <button className="button" disabled={busy} onClick={() => checkout('monthly')}>
            {prepaid?(en?'Add 1 month':'Adaugă 1 lună'):(en?'Choose monthly':'Alege lunar')} <ArrowUpRight size={15} />
          </button>
        ) : (
          <a className="button" href="/cont?tab=Abonament">
            Vezi în cont <ArrowUpRight size={15} />
          </a>
        )}
      </article>
      <article className="card subscription-option ac-plan-card">
        <div className="subscription-symbol">
          <CreditCard size={23} />
        </div>
        <p className="eyebrow">PREMIUM 3 LUNI</p>
        <h2>Un trimestru fără griji.</h2>
        <div className="subscription-price">
          {price(monthlyBani * 3)} <span>{en ? '/3 months' : 'lei / 3 luni'}</span>
        </div>
        <p className="small muted">
          {en
            ? `Equivalent to ${euro(monthlyBani)}/month, billed every 3 months.`
            : `Echivalent cu ${amount(monthlyBani)} lei/lună, facturat la fiecare 3 luni.`}
        </p>
        <ul>
          <li>
            <Check size={15} />
            {en
              ? 'Maintenance planning and mileage estimates'
              : 'Planificare întreținere și estimări după kilometraj'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Expense analysis and history exports'
              : 'Analiza cheltuielilor și exporturi din istoric'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Configurable reminder preferences'
              : 'Preferințe configurabile pentru mementouri'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Priorities from saved deadlines and mileage'
              : 'Priorități după termene și kilometraj'}
          </li>

          <li>
            <Check size={15} /> {prepaid?(en?'One-time extension payment':'Prelungire cu plată unică'):(en?'Recurring billing every 3 months':'Facturare recurentă la 3 luni')}
          </li>
          <li>
            <Check size={15} /> Gestionare din portalul de facturare
          </li>
        </ul>
        {checkout ? (
          <button className="button" disabled={busy} onClick={() => checkout('quarterly')}>
            {prepaid?(en?'Add 3 months':'Adaugă 3 luni'):(en?'Choose 3 months':'Alege 3 luni')} <ArrowUpRight size={15} />
          </button>
        ) : (
          <a className="button" href="/cont?tab=Abonament">
            Vezi în cont <ArrowUpRight size={15} />
          </a>
        )}
      </article>
      <article className="card subscription-option annual-option ac-plan-card">
        <span className="best-plan">CEL MAI BUN RAPORT PREȚ–BENEFICII</span>
        <div className="subscription-symbol">
          <ShieldCheck size={23} />
        </div>
        <p className="eyebrow">PREMIUM ANUAL</p>
        <h2>Mai multă valoare.</h2>
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
          <li>
            <Check size={15} />
            {en
              ? 'Maintenance planning and mileage estimates'
              : 'Planificare întreținere și estimări după kilometraj'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Expense analysis and history exports'
              : 'Analiza cheltuielilor și exporturi din istoric'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Configurable reminder preferences'
              : 'Preferințe configurabile pentru mementouri'}
          </li>
          <li>
            <Check size={15} />
            {en
              ? 'Priorities from saved deadlines and mileage'
              : 'Priorități după termene și kilometraj'}
          </li>

          <li>
            <Check size={15} /> {prepaid?(en?'One-time extension payment':'Prelungire cu plată unică'):(en?'Annual recurring billing':'Facturare recurentă anuală')}
          </li>
          <li>
            <Check size={15} />{' '}
            {s.savingBani > 0 ? 'Cost mai mic față de 12 plăți lunare' : 'O singură plată pe an'}
          </li>
        </ul>
        {checkout ? (
          <button className="primary" disabled={busy} onClick={() => checkout('annual')}>
            {prepaid?(en?'Add 12 months':'Adaugă 12 luni'):(en?'Choose annual':'Alege anual')} <ArrowUpRight size={15} />
          </button>
        ) : (
          <a className="button primary" href="/cont?tab=Abonament">
            Vezi în cont <ArrowUpRight size={15} />
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
    <div className="membership-workspace">
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
        <PremiumSales language={language} attachmentLimit={data.planLimits.attachments} />
      )}
      <PremiumWorkspace data={data} language={language} navigate={navigate} onRecord={onRecord} />
      {data.premium && <PremiumCareTools data={data} language={language} preview={preview} onRecord={onRecord}/> }
      {data.premium && <div id="premium-reports" style={{scrollMarginTop:90}}><PremiumDownloads data={data} language={language} preview={preview} /></div>}
      <section className="card" id="premium-plans" data-workspace-ui><h3>{language==='en'?'Subscription and renewal':'Abonament și prelungire'}</h3><p>{language==='en'?'Manage your paid period, plans and invoices on the dedicated subscription page.':'Gestionează perioada achitată, planurile și facturile pe pagina separată de abonament.'}</p><button type="button" onClick={()=>navigate('Abonament')}>{language==='en'?'Open subscription':'Deschide abonamentul'}</button></section>
    </div>
  );
}
