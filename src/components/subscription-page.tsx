'use client';
import { useEffect, useState } from 'react';
import type {BillingCurrency} from '@/lib/billing-currency';
import { PriceCards } from './membership';
import './subscription-premium-layout.css';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
export default function SubscriptionPage({
  data,
  language,
  busy,
  checkout,
  portal,
  invoices,
}: {
  data: Data;
  language: 'ro' | 'en';
  busy: boolean;
  checkout: (interval: string, extend: boolean, currency?:BillingCurrency) => void;
  portal: () => void;
  invoices: Array<{
    id: string;
    amountBani: number;
    currency: string;
    status: string;
    livemode?: boolean;
    createdAt?: string;
  }>;
}) {
  const [selectedPlan, setSelectedPlan] = useState('');
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('plan') ?? '';
    if (['monthly', 'quarterly', 'annual'].includes(value)) setSelectedPlan(value);
  }, []);
  const en = language === 'en',
    grants = data.premiumAccess.manual,
    lifetime = grants.some((g) => !g.expiresAt),
    until = Math.max(
      new Date(data.premiumAccess.paidUntil || 0).getTime(),
      ...grants.map((g) => (g.expiresAt ? new Date(g.expiresAt).getTime() : 0)),
    );
  const date =
    Number.isFinite(until) && until > Date.now()
      ? new Date(until).toLocaleString(en ? 'en-GB' : 'ro-RO', { timeZone: data.profile.timezone })
      : null;
  const remainingDays = date ? Math.max(0, Math.ceil((until - Date.now()) / 86400000)) : 0;
  const expiryDate = date ? new Date(until).toLocaleDateString(en ? 'en-GB' : 'ro-RO', { timeZone: data.profile.timezone, day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const expiryTime = date ? new Date(until).toLocaleTimeString(en ? 'en-GB' : 'ro-RO', { timeZone: data.profile.timezone, hour: '2-digit', minute: '2-digit' }) : null;
  const recurring =
      !!data.subscription?.subscriptionId &&
      ['active', 'trialing'].includes(data.subscription.status),
    cancelled = data.subscription?.cancelAtPeriodEnd;
  return (
    <div className="stack ac-subscription-workspace" data-workspace-ui>
      <section className="card ac-subscription-hero" aria-label={en ? 'Premium membership status' : 'Starea abonamentului Premium'}>
        <div className="ac-subscription-hero-head">
          <div><p className="eyebrow">AUTOCARE · {en ? 'YOUR MEMBERSHIP' : 'ABONAMENTUL TĂU'}</p>
            <h2>{en ? 'Premium, with every detail in one place.' : 'Premium, cu toate detaliile la vedere.'}</h2></div>
          <span className="ac-subscription-status" data-active={data.premium}>{data.premium ? (en ? 'Premium active' : 'Premium activ') : (en ? 'Free plan' : 'Plan gratuit')}</span>
        </div>
        <div className="ac-subscription-metrics">
          <div className="ac-subscription-metric"><span>{en ? 'Access valid until' : 'Acces valabil până la'}</span><strong>{lifetime ? (en ? 'No expiration' : 'Fără expirare') : expiryDate || (en ? 'No active subscription' : 'Fără abonament activ')}</strong><small>{lifetime ? (en ? 'Lifetime Premium access' : 'Acces Premium permanent') : expiryTime ? (en ? 'At ' : 'Ora ') + expiryTime + ' · ' + data.profile.timezone : (en ? 'Activate Premium to see your expiration date.' : 'Activează Premium pentru a vedea data expirării.')}</small></div>
          <div className="ac-subscription-metric"><span>{en ? 'Time remaining' : 'Timp rămas'}</span><strong>{lifetime ? '∞' : date ? remainingDays.toLocaleString(en ? 'en-GB' : 'ro-RO') : '—'}</strong><small>{lifetime ? (en ? 'Unlimited' : 'Nelimitat') : date ? (en ? remainingDays === 1 ? 'day remaining' : 'days remaining' : remainingDays === 1 ? 'zi rămasă' : 'zile rămase') : (en ? 'No paid access' : 'Fără acces plătit')}</small></div>
          <div className="ac-subscription-metric"><span>{en ? 'Renewal' : 'Reînnoire'}</span><strong>{recurring ? cancelled ? (en ? 'Cancelled' : 'Anulată') : (en ? 'Automatic' : 'Automată') : (en ? 'Not automatic' : 'Nu este automată')}</strong><small>{recurring ? cancelled ? (en ? 'Access remains until expiry' : 'Accesul rămâne până la expirare') : (en ? 'Manage in billing portal' : 'Gestionează din portalul de plăți') : (en ? 'No recurring charge' : 'Fără debitare recurentă')}</small></div>
        </div>
        <p className="ac-subscription-explainer">{lifetime && recurring ? (en ? 'Your permanent access is separate from the Stripe subscription.' : 'Accesul permanent este separat de abonamentul Stripe.') : recurring ? cancelled ? (en ? 'Automatic renewal is cancelled; your paid access stays active until the displayed deadline.' : 'Reînnoirea automată este anulată; accesul plătit rămâne activ până la data afișată.') : (en ? 'Your subscription renews automatically unless cancelled. Paid extensions preserve the remaining period.' : 'Abonamentul se reînnoiește automat dacă nu îl anulezi. Prelungirile păstrează perioada rămasă.') : (en ? 'Gifted and prepaid access never creates an automatic charge.' : 'Accesul oferit sau preplătit nu generează debitări automate.')}</p>
        {data.subscription?.customerId && <button className="ac-subscription-manage" disabled={busy} onClick={portal}>{en ? 'Manage payments and cancellation' : 'Gestionează plățile și anularea'}</button>}
      </section>
      {(
        <>
          <section className="card">
            <h3>
              {lifetime ? (en?'Plans and prices':'Planuri și prețuri') : data.premium
                ? en
                  ? 'Extend your Premium access'
                  : 'Prelungește accesul Premium'
                : en
                  ? 'Choose Premium'
                  : 'Alege Premium'}
            </h3>
            <p>
              {lifetime ? (en?'Your access has no expiry. The plans below are informational; no extension is needed.':'Accesul tău nu expiră. Planurile de mai jos sunt informative; nu este necesară prelungirea.') : data.premium
                ? en
                  ? 'Your remaining days are preserved. Another month is added after your current paid deadline. This is one payment; an existing recurring subscription keeps its plan and moves its next billing date.'
                  : 'Păstrezi zilele rămase. Încă o lună se adaugă după termenul actual. Prelungirea se achită o singură dată; abonamentul recurent existent își păstrează planul și mută următoarea facturare.'
                : en
                  ? 'Choose a billing period. These plans renew automatically until cancelled.'
                  : 'Alege perioada de facturare. Aceste planuri se reînnoiesc automat până la anulare.'}
            </p>
          </section>
          <PriceCards
            selectedPlan={selectedPlan}
            monthlyBani={data.pricing.monthlyBani}
            annualBani={data.pricing.annualBani}
            language={language}
            busy={busy||lifetime}
            prepaid={data.premium}
            reportTimezone={data.premium ? data.profile.timezone : undefined}
            checkout={(interval,currency) => checkout(interval, data.premium,currency)}
          />
        </>
      )}
      <p className="micro">{en?'Pay in RON or EUR at the displayed catalog price. Your existing subscription keeps its billing currency.':'Plătești în RON sau EUR, la tariful afișat. Abonamentul existent își păstrează moneda de facturare.'}</p>
      <section className="card">
        <h3>{en ? 'Payment history' : 'Istoricul plăților'}</h3>
        {invoices.length ? (
          invoices.map((i) => (
            <p key={i.id}>
              {new Intl.NumberFormat(en ? 'en-GB' : 'ro-RO', {
                style: 'currency',
                currency: i.currency.toUpperCase(),
              }).format(i.amountBani / 100)}{' '}
              · {i.createdAt?new Date(i.createdAt).toLocaleDateString(en?'en-GB':'ro-RO')+' · ':''}{i.status==='paid'?(en?'Confirmed':'Confirmată'):i.status==='refunded'?(en?'Refunded':'Rambursată'):i.status}
              {i.livemode === false ? ' · TEST' : ''}
              {i.status === 'paid' && i.id.startsWith('in_') && <> · <a href={'/api/v1/billing/invoices/' + encodeURIComponent(i.id)} target="_blank" rel="noopener noreferrer">{en ? 'View invoice' : 'Deschide factura'}</a></>}
            </p>
          ))
        ) : (
          <p>
            {en
              ? 'No confirmed payments recorded. Gifted access does not create an invoice.'
              : 'Nu sunt plăți confirmate înregistrate. Accesul oferit nu generează facturi.'}
          </p>
        )}
        <p>
          {en
            ? 'After checkout, the deadline updates only after Stripe confirms payment. If confirmation is delayed, reopen this page; it refreshes automatically while open.'
            : 'După plată, termenul se actualizează numai după confirmarea Stripe. Dacă există o întârziere, redeschide pagina; cât timp este deschisă, se reîmprospătează automat.'}
        </p>
      </section>
    </div>
  );
}
