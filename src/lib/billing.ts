import Stripe from 'stripe';
import {extensionCheckout,extensionEvent} from './subscription-extensions';
import { eq } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { AppError } from './service';
import { pricing } from './pricing';
import { origin } from './config';
import { queueAutomatedMail } from './mail-automation';
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError(503, 'Plățile nu sunt configurate.');
  if (process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS === 'true' && !['sk_live_', 'rk_live_'].some((prefix) => key.startsWith(prefix)))
    throw new AppError(503, 'Stripe necesită o cheie LIVE validă (sk_live_ sau rk_live_) cu permisiunile API necesare.');
  if (!key.startsWith('sk_test_') && process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS !== 'true')
    throw new AppError(503, 'Plățile reale sunt dezactivate în această versiune.');
  return new Stripe(key, { timeout: 12000, maxNetworkRetries: 1 });
}
export async function checkout(uid: string, interval: string, extend=false) {
  if (!['monthly', 'quarterly', 'annual'].includes(interval)) throw new AppError(400, 'Interval invalid.');
  const configured = await pricing();
  const price = interval === 'annual'
    ? process.env.STRIPE_ANNUAL_PRICE_ID || configured.annualPriceId
    : interval === 'quarterly'
      ? process.env.STRIPE_QUARTERLY_PRICE_ID
      : process.env.STRIPE_MONTHLY_PRICE_ID || configured.monthlyPriceId;
  if (!price)
    throw new AppError(
      503,
      'Prețurile procesatorului nu sunt configurate. Fondatorul trebuie să sincronizeze catalogul.',
    );
  const client = stripe();
  const remote = await client.prices.retrieve(price);
  const expectedAmount = interval === 'annual' ? configured.annualBani : interval === 'quarterly' ? configured.monthlyBani * 3 : configured.monthlyBani;
  const expectedInterval = interval === 'annual' ? 'year' : 'month';
  const expectedCount = interval === 'quarterly' ? 3 : 1;
  if (
    !remote.active ||
    remote.currency !== 'ron' ||
    remote.unit_amount !== expectedAmount ||
    remote.recurring?.interval !== expectedInterval ||
    remote.recurring.interval_count !== expectedCount
  )
    throw new AppError(
      503,
      'Prețul procesatorului nu corespunde tarifului RON afișat. Plata a fost oprită.',
    );
  if(extend)return extensionCheckout(uid,interval==='annual'?12:interval==='quarterly'?3:1,expectedAmount,client);
  const old = (await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)))[0];
  if (old?.subscriptionId && ['active', 'trialing', 'past_due', 'unpaid'].includes(old.status))
    throw new AppError(409, 'Gestionează abonamentul existent din portal.');
  const session = await client.checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: uid,
      metadata: { userId: uid },
      subscription_data: { metadata: { userId: uid } },
      customer: old?.customerId || undefined,
      success_url: origin() + '/cont?tab=Abonament',
      cancel_url: origin() + '/cont?tab=Abonament',
    },
    { idempotencyKey: `checkout-${uid}-${interval}-${Math.floor(Date.now() / 600000)}` },
  );
  return { url: session.url };
}
export async function billingPortal(uid: string) {
  const row = (await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)))[0];
  if (!row?.customerId) throw new AppError(404, 'Nu există un abonament.');
  return {
    url: (
      await stripe().billingPortal.sessions.create({
        customer: row.customerId,
        return_url: origin() + '/cont?tab=Abonament',
      })
    ).url,
  };
}
export async function processStripeEvent(event: Stripe.Event, client: Stripe) {
  if (event.livemode && process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS !== 'true')
    throw new AppError(400, 'Evenimentele live sunt dezactivate.');
  if ((await db().select().from(s.webhookEvents).where(eq(s.webhookEvents.id, event.id))).length)
    return { duplicate: true };
  const extension=await extensionEvent(event,client);if(extension)return extension;
  let sub: Stripe.Subscription | undefined;
  let invoice: Stripe.Invoice | undefined;
  let refunded = false;
  if (event.type.startsWith('customer.subscription.'))
    sub = await client.subscriptions.retrieve((event.data.object as Stripe.Subscription).id, {
      expand: ['latest_invoice'],
    });
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    invoice = event.data.object as Stripe.Invoice;
    const id = invoice.parent?.subscription_details?.subscription;
    if (id)
      sub = await client.subscriptions.retrieve(typeof id === 'string' ? id : id.id, {
        expand: ['latest_invoice'],
      });
  }
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    if (charge.refunded && charge.payment_intent) {
      const pi =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent.id;
      const payments = await client.invoicePayments.list({
        payment: { type: 'payment_intent', payment_intent: pi },
        limit: 100,
      });
      for (const payment of payments.data) {
        const inv = await client.invoices.retrieve(
          typeof payment.invoice === 'string' ? payment.invoice : payment.invoice.id,
        );
        const ref = inv.parent?.subscription_details?.subscription;
        if (ref) {
          const current = await client.subscriptions.retrieve(
            typeof ref === 'string' ? ref : ref.id,
            { expand: ['latest_invoice'] },
          );
          const latestId =
            typeof current.latest_invoice === 'string'
              ? current.latest_invoice
              : current.latest_invoice?.id;
          if (latestId === inv.id) {
            sub = current;
            invoice = inv;
            refunded = true;
            break;
          }
        }
      }
    }
  }
  if (!sub) {
    await db().insert(s.webhookEvents).values({ id: event.id }).onConflictDoNothing();
    return { ignored: true };
  }
  const uid = sub.metadata.userId;
  if (!uid || !(await db().select({ id: s.user.id }).from(s.user).where(eq(s.user.id, uid))).length)
    throw new AppError(400, 'Proprietar abonament invalid.');
  const configured = await pricing();
  const historical = await db().select({ id: s.billingPrices.id }).from(s.billingPrices);
  const prices = [
    process.env.STRIPE_MONTHLY_PRICE_ID,
    process.env.STRIPE_QUARTERLY_PRICE_ID,
    process.env.STRIPE_ANNUAL_PRICE_ID,
    configured.monthlyPriceId,
    configured.annualPriceId,
    ...historical.map((x) => x.id),
  ].filter(Boolean);
  if (!sub.items.data.some((i) => prices.includes(i.price.id)))
    throw new AppError(400, 'Plan necunoscut.');
  const latest = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null;
  const old = (await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)))[0];
  const latestId = latest?.id || null;
  const revoked = refunded || (!!old?.refundedInvoiceId && old.refundedInvoiceId === latestId);
  const status = revoked
    ? 'refunded'
    : sub.status === 'active' && latest?.status !== 'paid'
      ? 'pending_payment'
      : sub.status;
  const end = Math.max(...sub.items.data.map((i) => i.current_period_end || 0));
  return db().transaction(async (tx) => {
    const created = await tx
      .insert(s.webhookEvents)
      .values({ id: event.id })
      .onConflictDoNothing()
      .returning();
    if (!created.length) return { duplicate: true };
    await tx
      .insert(s.subscriptions)
      .values({
        userId: uid,
        customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        subscriptionId: sub.id,
        refundedInvoiceId: refunded ? latestId : old?.refundedInvoiceId || null,
        status,
        periodEnd: end ? new Date(end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: s.subscriptions.userId,
        set: {
          subscriptionId: sub.id,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          refundedInvoiceId: refunded ? latestId : old?.refundedInvoiceId || null,
          status,
          periodEnd: end ? new Date(end * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          updatedAt: new Date(),
        },
      });
    if (invoice)
      await tx
        .insert(s.invoices)
        .values({
          id: invoice.id,
          livemode: event.livemode,
          userId: uid,
          amountBani: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status || 'unknown',
        })
        .onConflictDoUpdate({
          target: s.invoices.id,
          set: { status: invoice.status || 'unknown', amountBani: invoice.amount_paid },
        });
    if (invoice && event.type === 'invoice.paid' && invoice.billing_reason === 'subscription_cycle' && status === 'active')
      await queueAutomatedMail(uid, 'renewal', `renewal:${invoice.id}`, { subscriptionId: sub.id, invoiceId: invoice.id, periodEnd: end ? new Date(end * 1000).toISOString() : undefined }, tx);
    if (invoice && event.type === 'invoice.payment_failed' && ['past_due','unpaid','incomplete','pending_payment'].includes(status))
      await queueAutomatedMail(uid, 'payment_failed', `payment-failed:${invoice.id}:${invoice.attempt_count}`, { subscriptionId: sub.id, invoiceId: invoice.id, periodEnd: end ? new Date(end * 1000).toISOString() : undefined }, tx);
    return { processed: true };
  });
}
