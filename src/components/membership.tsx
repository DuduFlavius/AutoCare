'use client';
import {useApplicationLocale} from './application-locale';
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
  language = 'ro',
}: {
  monthlyBani: number;
  annualBani: number;
  checkout?: (interval: string) => void;
  busy?: boolean;
  language?: 'ro' | 'en';
}) {

  const locale=useApplicationLocale();
const s = savings(monthlyBani, annualBani);
  const en = language === 'en';
  const euro = (b: number) => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(b / 500);
  const price = (b: number) => en ? euro(b) : amount(b);
  return (
    <div className="subscription-options">
      <article className="card subscription-option">
        <div className="subscription-symbol">
          <CreditCard size={23} />
        </div>
        <p className="eyebrow">PREMIUM LUNAR</p>
        <h2>Flexibil, lună de lună.</h2>
        <div className="subscription-price">
          {price(monthlyBani)} <span>{en ? '/month' : 'lei/lună'}</span>
        </div>
        <p className="small muted">
          {en ? `${euro(s.annualMonthlyBani)} for 12 monthly payments.` : `${amount(s.annualMonthlyBani)} lei pentru 12 luni de plată lunară.`}
        </p>
        <ul>
          <li>
            <Check size={15} /> Toate funcțiile Premium ale planului
          </li>
          <li>
            <Check size={15} /> Facturare recurentă lunară
          </li>
          <li>
            <Check size={15} /> Gestionare din portalul de facturare
          </li>
        </ul>
        {checkout ? (
          <button className="button" disabled={busy} onClick={() => checkout('monthly')}>
            Alege lunar <ArrowUpRight size={15} />
          </button>
        ) : (
          <a className="button" href="/cont?tab=Abonament">
            Vezi în cont <ArrowUpRight size={15} />
          </a>
        )}
      </article>
      <article className="card subscription-option">
        <div className="subscription-symbol"><CreditCard size={23} /></div>
        <p className="eyebrow">PREMIUM 3 LUNI</p>
        <h2>Un trimestru fără griji.</h2>
        <div className="subscription-price">{price(monthlyBani * 3)} <span>{en ? '/3 months' : 'lei / 3 luni'}</span></div>
        <p className="small muted">{en ? `Equivalent to ${euro(monthlyBani)}/month, billed every 3 months.` : `Echivalent cu ${amount(monthlyBani)} lei/lună, facturat la fiecare 3 luni.`}</p>
        <ul>
          <li><Check size={15} /> Toate funcțiile Premium</li>
          <li><Check size={15} /> Facturare recurentă la 3 luni</li>
          <li><Check size={15} /> Gestionare din portalul de facturare</li>
        </ul>
        {checkout ? <button className="button" disabled={busy} onClick={() => checkout('quarterly')}>Alege 3 luni <ArrowUpRight size={15} /></button> : <a className="button" href="/cont?tab=Abonament">Vezi în cont <ArrowUpRight size={15} /></a>}
      </article>
      <article className="card subscription-option annual-option">
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
              {en ? `Save ${euro(s.savingBani)}/year` : `Economisești ${amount(s.savingBani)} lei/an`} ·{' '}
              {s.savingPercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%
            </>
          ) : (
            (en ? 'One annual payment.' : 'Plată anuală într-o singură tranșă.')
          )}
        </p>
        <ul>
          <li>
            <Check size={15} /> Aceleași funcții Premium
          </li>
          <li>
            <Check size={15} /> Facturare recurentă anuală
          </li>
          <li>
            <Check size={15} />{' '}
            {s.savingBani > 0 ? 'Cost mai mic față de 12 plăți lunare' : 'O singură plată pe an'}
          </li>
        </ul>
        {checkout ? (
          <button className="primary" disabled={busy} onClick={() => checkout('annual')}>
            Alege anual <ArrowUpRight size={15} />
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
  checkout,
  portal,
  invoices,
}: {
  language?: 'ro' | 'en';
  data: Data;
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

  const locale=useApplicationLocale();
return (
    <div className="membership-workspace">
      <section className="card membership-current">
        <div className="settings-section-title">
          <span className="list-icon">
            <ShieldCheck size={24} />
          </span>
          <div>
            <p className="eyebrow">{language === 'en' ? 'YOUR CURRENT ACCESS' : 'ACCESUL TĂU ACTUAL'}</p>
            <h2>{data.premium ? 'AutoCare Premium' : (language === 'en' ? 'Free plan' : 'Plan gratuit')}</h2>
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
                : data.premiumAccess.manual.length
                  ? new Date(
                      Math.max(
                        ...data.premiumAccess.manual.map((g) => new Date(g.expiresAt!).getTime()),
                      ),
                    ).toLocaleDateString(locale)
                  : data.subscription?.periodEnd
                    ? new Date(data.subscription.periodEnd).toLocaleDateString(locale)
                    : 'Fără abonament activ'}
            </strong>
          </div>
          <div>
            <span className="small muted">Garaj</span>
            <strong>{data.vehicles.filter((v) => !v.archived).length} mașini active</strong>
          </div>
        </div>
        {data.subscription?.customerId && (
          <button disabled={busy} onClick={portal}>
            Gestionează facturarea <ArrowUpRight size={14} />
          </button>
        )}
      </section>
      <section className="card ac-premium-benefits">
        <p className="eyebrow">DE CE AUTOCARE PREMIUM?</p>
        <h2>Mai mult control asupra fiecărei mașini.</h2>
        <p className="small muted">Premium deblochează funcții suplimentare pentru organizarea, urmărirea și analiza întreținerii. Toate planurile Premium au aceleași funcții; diferă doar perioada de facturare.</p>
        <div className="ac-premium-benefit-grid">
          <div><strong>Mai multe mașini</strong><p>Adaugă oricâte mașini dorești în garaj, față de o singură mașină în planul gratuit.</p></div>
          <div><strong>Istoric și exporturi</strong><p>Urmărește intervențiile, costurile și exportă datele disponibile în format CSV.</p></div>
          <div><strong>Mai multă flexibilitate</strong><p>Configurează ora locală preferată pentru mementouri și gestionează termenele de întreținere.</p></div>
          <div><strong>Documente și cheltuieli</strong><p>Păstrează în același loc documentele, intervențiile și costurile pentru mașinile tale.</p></div>
        </div>
        <h3>Gratuit sau Premium?</h3>
        <div className="ac-premium-comparison" role="table" aria-label="Comparație planuri">
          <div role="row"><strong role="columnheader">Funcție</strong><strong role="columnheader">Gratuit</strong><strong role="columnheader">Premium</strong></div>
          <div role="row"><span>Mașini active</span><span>1</span><span>Nelimitate</span></div>
          <div role="row"><span>Documente și istoric de bază</span><span>Inclus</span><span>Inclus</span></div>
          <div role="row"><span>Export CSV Premium</span><span>Nu</span><span>Da</span></div>
          <div role="row"><span>Ora preferată a alertelor</span><span>Standard</span><span>Configurabilă</span></div>
        </div>
        <p className="micro">Notificările pe dispozitiv necesită permisiunea browserului și configurarea serviciului push; nu sunt garantate doar prin cumpărarea Premium.</p>
      </section>
      <PriceCards
        monthlyBani={data.pricing.monthlyBani}
        annualBani={data.pricing.annualBani}
        busy={busy}
        checkout={checkout}
        language={language}
      />
      <p className="micro">
        {language === 'en' && <strong>EUR amounts are indicative at 1 EUR ≈ 5 RON. Checkout is billed in RON at the confirmed Stripe price. </strong>}
        Tarife în RON. Plata se deschide numai dacă prețul procesatorului corespunde sumei afișate.
        Accesul manual nu declanșează plăți. Abonamentele existente își păstrează condițiile din
        portal.
      </p>
      <section className="card">
        <h3>Istoricul facturării</h3>
        {invoices.length ? (
          invoices.map((i) => (
            <div className="list-row" key={i.id}>
              <span>{new Date(i.createdAt).toLocaleDateString(locale)}</span>
              <strong>
                {amount(i.amountBani)} {i.currency.toUpperCase()}
              </strong>
              <span className="pill">{i.status === 'paid' ? 'Plată confirmată' : i.status}</span>
              {!i.livemode && <span className="pill archived">Test · nu este venit real</span>}
            </div>
          ))
        ) : (
          <p className="small muted">
            Nu ai facturi înregistrate. Accesul oferit manual nu generează facturi sau încasări.
          </p>
        )}
      </section>
    </div>
  );
}
