'use client';
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
}: {
  monthlyBani: number;
  annualBani: number;
  checkout?: (interval: string) => void;
  busy?: boolean;
}) {
  const s = savings(monthlyBani, annualBani);
  return (
    <div className="subscription-options">
      <article className="card subscription-option">
        <div className="subscription-symbol">
          <CreditCard size={23} />
        </div>
        <p className="eyebrow">PREMIUM LUNAR</p>
        <h2>Flexibil, lună de lună.</h2>
        <div className="subscription-price">
          {amount(monthlyBani)} <span>lei/lună</span>
        </div>
        <p className="small muted">
          {amount(s.annualMonthlyBani)} lei pentru 12 luni de plată lunară.
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
      <article className="card subscription-option annual-option">
        <span className="best-plan">CEL MAI BUN RAPORT PREȚ–BENEFICII</span>
        <div className="subscription-symbol">
          <ShieldCheck size={23} />
        </div>
        <p className="eyebrow">PREMIUM ANUAL</p>
        <h2>Mai multă valoare.</h2>
        <div className="subscription-price">
          {amount(annualBani)} <span>lei/an</span>
        </div>
        <p className="subscription-saving">
          {s.savingBani > 0 ? (
            <>
              Economisești {amount(s.savingBani)} lei/an ·{' '}
              {s.savingPercent.toLocaleString('ro-RO', { maximumFractionDigits: 1 })}%
            </>
          ) : (
            'Plată anuală într-o singură tranșă.'
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
  data,
  busy,
  checkout,
  portal,
  invoices,
}: {
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
  return (
    <div className="membership-workspace">
      <section className="card membership-current">
        <div className="settings-section-title">
          <span className="list-icon">
            <ShieldCheck size={24} />
          </span>
          <div>
            <p className="eyebrow">ACCESUL TĂU ACTUAL</p>
            <h2>{data.premium ? 'AutoCare Premium' : 'Plan gratuit'}</h2>
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
                    ).toLocaleDateString('ro-RO')
                  : data.subscription?.periodEnd
                    ? new Date(data.subscription.periodEnd).toLocaleDateString('ro-RO')
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
      <PriceCards
        monthlyBani={data.pricing.monthlyBani}
        annualBani={data.pricing.annualBani}
        busy={busy}
        checkout={checkout}
      />
      <p className="micro">
        Tarife în RON. Plata se deschide numai dacă prețul procesatorului corespunde sumei afișate.
        Accesul manual nu declanșează plăți. Abonamentele existente își păstrează condițiile din
        portal.
      </p>
      <section className="card">
        <h3>Istoricul facturării</h3>
        {invoices.length ? (
          invoices.map((i) => (
            <div className="list-row" key={i.id}>
              <span>{new Date(i.createdAt).toLocaleDateString('ro-RO')}</span>
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
