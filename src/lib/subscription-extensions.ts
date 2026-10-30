import Stripe from 'stripe';
import { and, eq, sql, desc } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { AppError, activeGrants } from './service';
import { isPremium, origin } from './config';
import { addPaidMonths } from './paid-coverage';
export async function extensionCheckout(
  uid: string,
  months: number,
  amountBani: number,
  client: Stripe,
) {
  const old = (await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)))[0];
  if (old && ['past_due', 'unpaid', 'pending_payment', 'incomplete'].includes(old.status))
    throw new AppError(409, 'Rezolvă mai întâi plata restantă din portalul de facturare.');
  const pending=(await db().select().from(s.subscriptionExtensions).where(and(eq(s.subscriptionExtensions.userId,uid),sql`${s.subscriptionExtensions.status} IN ('pending','processing')`)))[0];
  if(pending){
    const session=await client.checkout.sessions.retrieve(pending.sessionId);
    if(session.payment_status==='paid')await confirmExtension(session.id,'reconcile:'+session.id,session.livemode,client);
    else if(session.status==='expired')await db().update(s.subscriptionExtensions).set({status:'expired'}).where(eq(s.subscriptionExtensions.id,pending.id));
    else if(session.status==='open'&&pending.months===months&&pending.amountBani===amountBani)return{url:session.url};
    else throw new AppError(409,'Există o plată în curs. Finalizeaz-o sau așteaptă expirarea ei înainte de a alege alt plan.');
  }
  const grants = await activeGrants(uid);
  if (grants.some((g) => !g.expiresAt))
    throw new AppError(409, 'Ai deja acces Premium fără expirare. Nu este necesară prelungirea.');
  const existing = await db()
    .select()
    .from(s.subscriptionExtensions)
    .where(
      and(
        eq(s.subscriptionExtensions.userId, uid),
        sql`${s.subscriptionExtensions.status} IN ('paid','processing')`,
      ),
    )
    .orderBy(desc(s.subscriptionExtensions.endsAt));
  const now = new Date(),
    base = new Date(
      Math.max(
        now.getTime(),
        isPremium(old) ? old.periodEnd!.getTime() : 0,
        ...grants.map((g) => g.expiresAt?.getTime() || 0),
        ...existing.map((g) => g.endsAt?.getTime() || 0),
      ),
    );
  if (addPaidMonths(base, months).getTime() > addPaidMonths(now, 23).getTime())
    throw new AppError(400, 'Poți prelungi accesul până la maximum 23 de luni în avans.');
  const id = crypto.randomUUID();
  const session = await client.checkout.sessions.create(
    {
      mode: 'payment',
      customer: old?.customerId || undefined,
      customer_creation: old?.customerId ? undefined : 'always',
      client_reference_id: uid,
      metadata: { userId: uid, purpose: 'premium_extension', extensionId: id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'ron',
            unit_amount: amountBani,
            product_data: { name: `AutoCare Premium · prelungire ${months} luni` },
          },
        },
      ],
      success_url: origin() + '/cont?tab=Abonament&payment=processing',
      cancel_url: origin() + '/cont?tab=Abonament',
    },
    { idempotencyKey: 'extension-checkout-' + id },
  );
  await db()
    .insert(s.subscriptionExtensions)
    .values({ id, userId: uid, sessionId: session.id, months, amountBani });
  return { url: session.url };
}
export async function extensionEvent(event: Stripe.Event, client: Stripe) {
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const pi =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!charge.refunded || !pi) return null;
    const rows = await db()
      .select()
      .from(s.subscriptionExtensions)
      .where(eq(s.subscriptionExtensions.paymentIntent, pi));
    if (!rows.length) return null;
    await db().transaction(async (tx) => {
      await tx
        .update(s.subscriptionExtensions)
        .set({ status: 'refunded' })
        .where(eq(s.subscriptionExtensions.paymentIntent, pi));
      for (const r of rows)
        await tx
          .update(s.invoices)
          .set({ status: 'refunded', amountBani: 0 })
          .where(eq(s.invoices.id, r.sessionId));
      await tx.insert(s.webhookEvents).values({ id: event.id }).onConflictDoNothing();
    });
    return { processed: true };
  }
  if (
    !['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
  )
    return null;
  const stub = event.data.object as Stripe.Checkout.Session;
  return confirmExtension(stub.id, event.id, event.livemode, client);
}
export async function confirmExtension(
  sessionId: string,
  eventId: string,
  livemode: boolean,
  client: Stripe,
) {
  const known = (
    await db()
      .select()
      .from(s.subscriptionExtensions)
      .where(eq(s.subscriptionExtensions.sessionId, sessionId))
  )[0];
  if (!known) return null;
  if (known.status === 'paid' || known.status === 'refunded') return { duplicate: true };
  const session = await client.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });
  if (session.payment_status !== 'paid') return { pending: true };
  if (
    session.mode !== 'payment' ||
    session.currency !== 'ron' ||
    session.amount_total !== known.amountBani ||
    session.client_reference_id !== known.userId ||
    session.metadata?.extensionId !== known.id ||
    session.livemode !== livemode
  )
    throw new AppError(400, 'Plată de prelungire invalidă.');
  const pi =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!pi) throw new AppError(400, 'Plata nu are confirmare.');
  const grants = await activeGrants(known.userId);
  // Reserve the dates once. Retries reuse them even if Stripe has already moved its billing date.
  await db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, known.userId)).for('update');
    const row = (
      await tx
        .select()
        .from(s.subscriptionExtensions)
        .where(eq(s.subscriptionExtensions.id, known.id))
        .for('update')
    )[0];
    if (row.endsAt) return;
    const sub = (
      await tx.select().from(s.subscriptions).where(eq(s.subscriptions.userId, row.userId))
    )[0];
    const extensions = await tx
      .select()
      .from(s.subscriptionExtensions)
      .where(
        and(
          eq(s.subscriptionExtensions.userId, row.userId),
          sql`${s.subscriptionExtensions.status} IN ('paid','processing')`,
        ),
      );
    const start = new Date(
      Math.max(
        Date.now(),
        isPremium(sub) ? sub.periodEnd!.getTime() : 0,
        ...grants.map((g) => g.expiresAt?.getTime() || 0),
        ...extensions.map((e) => e.endsAt?.getTime() || 0),
      ),
    );
    await tx
      .update(s.subscriptionExtensions)
      .set({
        status: 'processing',
        paymentIntent: pi,
        startsAt: start,
        endsAt: addPaidMonths(start, row.months),
      })
      .where(eq(s.subscriptionExtensions.id, row.id));
  });
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, known.userId)).for('update');
    const row = (
      await tx
        .select()
        .from(s.subscriptionExtensions)
        .where(eq(s.subscriptionExtensions.id, known.id))
    )[0];
    if (row.status === 'paid' || row.status === 'refunded') return { duplicate: true };
    const sub = (
      await tx.select().from(s.subscriptions).where(eq(s.subscriptions.userId, row.userId))
    )[0];
    const extensions = await tx
      .select()
      .from(s.subscriptionExtensions)
      .where(
        and(
          eq(s.subscriptionExtensions.userId, row.userId),
          sql`${s.subscriptionExtensions.status} IN ('paid','processing')`,
        ),
      );
    const end = Math.max(...extensions.map((e) => e.endsAt?.getTime() || 0));
    if (sub?.subscriptionId && ['active', 'trialing'].includes(sub.status)) {
      const remote = await client.subscriptions.retrieve(sub.subscriptionId);
      if (remote.metadata.userId !== row.userId) throw new AppError(400, 'Abonament invalid.');
      if (['active', 'trialing'].includes(remote.status))
        await client.subscriptions.update(
          remote.id,
          {
            trial_end: Math.max(Math.floor(end / 1000), remote.trial_end || 0),
            proration_behavior: 'none',
          },
          { idempotencyKey: 'extension-sync-' + row.id + '-' + Math.floor(end / 1000) },
        );
    }
    if(!sub&&session.customer)await tx.insert(s.subscriptions).values({userId:row.userId,customerId:typeof session.customer==='string'?session.customer:session.customer.id,status:'free'}).onConflictDoNothing();
    await tx
      .update(s.subscriptionExtensions)
      .set({ status: 'paid' })
      .where(eq(s.subscriptionExtensions.id, row.id));
    await tx
      .insert(s.invoices)
      .values({
        id: row.sessionId,
        userId: row.userId,
        livemode: livemode,
        amountBani: row.amountBani,
        currency: 'ron',
        status: 'paid',
      })
      .onConflictDoNothing();
    await tx.insert(s.webhookEvents).values({ id: eventId }).onConflictDoNothing();
    return { processed: true };
  });
}

/** Reconcile only the signed-in owner's pending purchases against Stripe, never URL parameters. */
export async function syncPaidExtensions(uid: string, client: Stripe) {
  const rows = await db()
    .select()
    .from(s.subscriptionExtensions)
    .where(
      and(
        eq(s.subscriptionExtensions.userId, uid),
        sql`${s.subscriptionExtensions.status} IN ('pending','processing')`,
      ),
    )
    .orderBy(desc(s.subscriptionExtensions.createdAt))
    .limit(5);
  for (const row of rows) {
    const session = await client.checkout.sessions.retrieve(row.sessionId);
    await confirmExtension(row.sessionId, 'reconcile:' + row.sessionId, session.livemode, client);
  }
  return { checked: rows.length };
}
