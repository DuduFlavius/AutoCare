import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { db, closeLocalDb } from '../src/lib/db';
import { migrate } from '../scripts/migrate';
import * as s from '../src/lib/schema';
import * as center from '../src/lib/mail-center';
import {
  queueAutomatedMail,
  automationState,
  scheduleSubscriptionMail,
} from '../src/lib/mail-automation';
import { billingMailValid } from '../src/lib/mail-policy';
import { emailTemplates, renderEmail, appLink } from '../src/lib/email-templates';
import { GoogleDeliveryError } from '../src/lib/google-mail';
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.APP_URL = 'https://project-sxage.vercel.app';
process.env.BETTER_AUTH_SECRET = 'mail-center-test-only-secret-at-least-32-characters';
const founder = crypto.randomUUID(),
  client = crypto.randomUUID(),
  other = crypto.randomUUID(),
  admin = crypto.randomUUID();
process.env.AUTOCARE_FOUNDER_USER_ID = founder;
const now = new Date('2030-01-01T10:00:00Z');
before(async () => {
  await migrate();
  for (const id of [founder, client, other, admin]) {
    await db()
      .insert(s.user)
      .values({
        id,
        name: id === client ? 'Ana <script>' : 'Test',
        email: id + '@example.invalid',
        emailVerified: true,
      });
    await db()
      .insert(s.profiles)
      .values({ userId: id, role: id === admin ? 'admin' : 'user' });
  }
});
after(closeLocalDb);
const input = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  template: 'administrative',
  category: 'transactional',
  subject: 'Actualizare AutoCare',
  message: 'O actualizare administrativă necesară contului tău.',
  ctaLabel: 'Vezi contul',
  ctaPath: '/cont',
  recipients: [client],
  ...overrides,
});
test('Every email template has escaped personalized HTML, responsive raster banner, CTA and plain text', () => {
  for (const id of Object.keys(emailTemplates) as (keyof typeof emailTemplates)[]) {
    const mail = renderEmail(id, {
      name: 'Ana <script>alert(1)</script>',
      message: 'Text <img src=x onerror=alert(1)>\n\nAlt paragraf.',
    });
    assert.match(mail.html, /@media only screen/);
    assert.match(mail.html, /width="600"/);
    assert.match(mail.html, /https:\/\/project-sxage.vercel.app\/design-car.jpg/);
    assert.match(mail.html, /&lt;script&gt;/);
    assert.ok(!mail.html.includes('<script>'));
    assert.match(mail.html, /role="presentation"/);
    assert.match(mail.text, /https:\/\/project-sxage.vercel.app/);
    assert.ok(mail.html.length < 100000);
  }
  assert.throws(() => appLink('//evil.invalid'));
  assert.throws(() => appLink('/\\evil.invalid'));
  assert.throws(() => renderEmail('administrative', { actionUrl: 'javascript:alert(1)' }));
  const link =
    'https://project-sxage.vercel.app/api/auth/verify-email?token=test-only&callbackURL=%2Fcont';
  const mail = renderEmail('verification', { actionUrl: link });
  assert.ok(mail.text.includes(link));
  assert.ok(mail.html.includes(link.replaceAll('&', '&amp;')));
});
test('Only Founder can author or read Mail Center; security templates cannot be sent as arbitrary campaigns', async () => {
  for (const uid of [client, admin]) {
    await assert.rejects(() => center.mailCenterOverview(uid));
    await assert.rejects(() => center.previewMail(uid, { template: 'welcome' }));
    await assert.rejects(() => center.saveCampaign(uid, input()));
  }
  for (const template of ['verification', 'password_reset', 'gmail_test'])
    await assert.rejects(() => center.saveCampaign(founder, input({ template })));
  await assert.rejects(() => center.saveCampaign(founder, input({ ctaPath: '//evil.invalid' })));
  await assert.rejects(() =>
    center.saveCampaign(founder, input({ template: 'promotional', category: 'transactional' })),
  );
});
test('Campaign creation is idempotent under concurrency and immutable for the same ID', async () => {
  const data = input({ recipients: [client, client, other] });
  const result = await Promise.all([
    center.saveCampaign(founder, data),
    center.saveCampaign(founder, data),
  ]);
  assert.equal(result.filter((x) => !x.duplicate).length, 1);
  const detail = await center.campaignDetail(founder, result[0].id);
  assert.equal(detail.deliveries.length, 2);
  await assert.rejects(() =>
    center.saveCampaign(founder, { ...data, message: 'Un alt conținut în același ID.' }),
  );
  let sent = 0;
  const transport: center.MailTransport = async () => {
    sent++;
    await new Promise((r) => setTimeout(r, 5));
    return 'provider-' + sent;
  };
  await Promise.all([
    center.deliverCampaign(result[0].id, transport),
    center.deliverCampaign(result[0].id, transport),
  ]);
  assert.equal(sent, 2);
  await center.deliverCampaign(result[0].id, transport);
  assert.equal(sent, 2);
  assert.ok(
    (await center.campaignDetail(founder, result[0].id)).deliveries.every(
      (x) => x.status === 'accepted',
    ),
  );
});
test('Promotional opt-in defaults off, opt-out after drafting is honored and client cannot set another user preferences', async () => {
  assert.equal((await center.getCommunicationPreference(client)).promotional, false);
  const first = await center.saveCampaign(
    founder,
    input({ template: 'promotional', category: 'promotional' }),
  );
  let sent = 0;
  await center.deliverCampaign(first.id, async () => {
    sent++;
    return 'id';
  });
  assert.equal(sent, 0);
  assert.equal((await center.campaignDetail(founder, first.id)).deliveries[0].status, 'suppressed');
  await center.saveCommunicationPreference(client, { transactional: true, promotional: true });
  const second = await center.saveCampaign(founder, input({ category: 'promotional' }));
  await center.saveCommunicationPreference(client, { transactional: true, promotional: false });
  await center.deliverCampaign(second.id, async () => {
    sent++;
    return 'id';
  });
  assert.equal(sent, 0);
  await assert.rejects(() =>
    center.saveCommunicationPreference(client, {
      transactional: true,
      promotional: true,
      userId: other,
    }),
  );
});
test('Global email opt-out, unverified accounts and suspension suppress manual delivery', async () => {
  let sent = 0;
  const transport = async () => {
    sent++;
    return 'id';
  };
  for (const state of ['optout', 'unverified', 'suspended']) {
    if (state === 'optout')
      await db()
        .update(s.profiles)
        .set({ emailEnabled: false })
        .where(eq(s.profiles.userId, other));
    if (state === 'unverified')
      await db().update(s.user).set({ emailVerified: false }).where(eq(s.user.id, other));
    if (state === 'suspended')
      await db().insert(s.accountRestrictions).values({ userId: other, suspendedAt: now });
    const campaign = await center.saveCampaign(founder, input({ recipients: [other] }));
    await center.deliverCampaign(campaign.id, transport);
    assert.equal(sent, 0);
    await db().update(s.profiles).set({ emailEnabled: true }).where(eq(s.profiles.userId, other));
    await db().update(s.user).set({ emailVerified: true }).where(eq(s.user.id, other));
  }
  await db().delete(s.accountRestrictions).where(eq(s.accountRestrictions.userId, other));
});
test('Ambiguous Gmail outcomes and interrupted workers are never automatically retried', async () => {
  const c = await center.saveCampaign(founder, input());
  let sent = 0;
  const fail = async () => {
    sent++;
    throw new GoogleDeliveryError('unknown', 'GMAIL_DELIVERY_UNCONFIRMED');
  };
  await center.deliverCampaign(c.id, fail);
  await center.deliverCampaign(c.id, fail);
  assert.equal(sent, 1);
  const detail = await center.campaignDetail(founder, c.id);
  assert.equal(detail.deliveries[0].status, 'unknown');
  assert.equal(detail.deliveries[0].error, 'GMAIL_DELIVERY_UNCONFIRMED');
  const interrupted = await center.saveCampaign(founder, input());
  await db()
    .update(s.mailDeliveries)
    .set({ status: 'sending', attemptedAt: new Date(now.getTime() - 180000) })
    .where(eq(s.mailDeliveries.campaignId, interrupted.id));
  await center.deliverCampaign(interrupted.id, fail, now);
  assert.equal(sent, 1);
  assert.equal(
    (await center.campaignDetail(founder, interrupted.id)).deliveries[0].status,
    'unknown',
  );
});
test('Automation queue is durable and deduplicated but both runtime and Founder approval gates default closed', async () => {
  await queueAutomatedMail(client, 'welcome', 'welcome:test');
  await queueAutomatedMail(client, 'welcome', 'welcome:test');
  const deliveries = await db()
    .select()
    .from(s.mailDeliveries)
    .where(eq(s.mailDeliveries.dedupeKey, 'welcome:test'));
  assert.equal(deliveries.length, 1);
  let sent = 0;
  await center.deliverCampaign(deliveries[0].campaignId, async () => {
    sent++;
    return 'id';
  });
  assert.equal(sent, 0);
  assert.equal((await automationState()).enabled, false);
  process.env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED = 'true';
  assert.equal((await automationState()).enabled, false);
  await db()
    .insert(s.settings)
    .values({
      key: 'mail-automation-approval',
      value: {
        approvedBy: 'not-founder',
        approvedAt: now.toISOString(),
        testedAt: now.toISOString(),
      },
    });
  assert.equal((await automationState()).enabled, false);
  delete process.env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED;
});
test('Expiry only targets finite nonrenewing access; renewal or lifetime grant changes suppress old messages', async () => {
  const periodEnd = new Date(now.getTime() + 3 * 86400000);
  await db().insert(s.subscriptions).values({
    userId: client,
    subscriptionId: 'sub-mail',
    status: 'active',
    periodEnd,
    cancelAtPeriodEnd: false,
  });
  assert.equal(await billingMailValid(client, 'premium_expiry', {}, now), false);
  await scheduleSubscriptionMail(now);
  assert.equal(
    (
      await db()
        .select()
        .from(s.mailDeliveries)
        .where(sql`${s.mailDeliveries.dedupeKey} LIKE 'expiry:%'`)
    ).length,
    0,
  );
  await db()
    .update(s.subscriptions)
    .set({ cancelAtPeriodEnd: true })
    .where(eq(s.subscriptions.userId, client));
  await scheduleSubscriptionMail(now);
  await scheduleSubscriptionMail(now);
  const rows = await db()
    .select()
    .from(s.mailDeliveries)
    .where(sql`${s.mailDeliveries.dedupeKey} LIKE 'expiry:%'`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'held');
  await db()
    .update(s.subscriptions)
    .set({ cancelAtPeriodEnd: false })
    .where(eq(s.subscriptions.userId, client));
  assert.equal(await billingMailValid(client, 'premium_expiry', rows[0].context, now), false);
  await db()
    .update(s.subscriptions)
    .set({ cancelAtPeriodEnd: true })
    .where(eq(s.subscriptions.userId, client));
  await db().insert(s.premiumGrants).values({
    id: crypto.randomUUID(),
    userId: client,
    grantedBy: founder,
    note: 'test lifetime',
    expiresAt: null,
  });
  assert.equal(await billingMailValid(client, 'premium_expiry', {}, now), false);
  await db().delete(s.premiumGrants).where(eq(s.premiumGrants.userId, client));
});
test('Payment failure is suppressed after recovery; renewal requires paid invoice and current cycle', async () => {
  await db()
    .update(s.subscriptions)
    .set({ status: 'past_due' })
    .where(eq(s.subscriptions.userId, client));
  assert.equal(await billingMailValid(client, 'payment_failed', {}, now), true);
  await db()
    .update(s.subscriptions)
    .set({ status: 'active' })
    .where(eq(s.subscriptions.userId, client));
  assert.equal(await billingMailValid(client, 'payment_failed', {}, now), false);
  await db().insert(s.invoices).values({
    id: 'mail-paid-invoice',
    userId: client,
    amountBani: 1000,
    currency: 'ron',
    status: 'paid',
  });
  assert.equal(
    await billingMailValid(
      client,
      'renewal',
      { invoiceId: 'mail-paid-invoice', subscriptionId: 'sub-mail' },
      now,
    ),
    true,
  );
  assert.equal(
    await billingMailValid(
      client,
      'renewal',
      { invoiceId: 'mail-paid-invoice', periodEnd: '2000-01-01T00:00:00.000Z' },
      now,
    ),
    false,
  );
});

test('Stripe recurring paid and failed invoice events queue held notifications atomically and deduplicate', async () => {
  const { processStripeEvent } = await import('../src/lib/billing');
  process.env.STRIPE_MONTHLY_PRICE_ID = 'price_mail_test';
  const sub = {
    id: 'sub_mail_events',
    metadata: { userId: other },
    customer: 'cus_mail_events',
    status: 'active',
    cancel_at_period_end: false,
    latest_invoice: { id: 'invoice_cycle_mail', status: 'paid' },
    items: {
      data: [
        {
          price: { id: 'price_mail_test' },
          current_period_end: Math.floor(now.getTime() / 1000) + 864000,
        },
      ],
    },
  };
  const fake = {
    subscriptions: { retrieve: async () => sub },
  } as unknown as import('stripe').default;
  const invoice = {
    id: 'invoice_cycle_mail',
    parent: { subscription_details: { subscription: sub.id } },
    billing_reason: 'subscription_cycle',
    status: 'paid',
    amount_paid: 1000,
    currency: 'ron',
    attempt_count: 1,
  };
  const event = {
    id: 'evt_mail_paid',
    type: 'invoice.paid',
    livemode: false,
    data: { object: invoice },
  } as unknown as import('stripe').default.Event;
  await processStripeEvent(event, fake);
  await processStripeEvent(event, fake);
  let rows = await db()
    .select()
    .from(s.mailDeliveries)
    .where(eq(s.mailDeliveries.dedupeKey, 'renewal:invoice_cycle_mail'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'held');
  sub.status = 'past_due';
  sub.latest_invoice = { id: 'invoice_failed_mail', status: 'open' };
  const failed = { ...invoice, id: 'invoice_failed_mail', status: 'open', amount_paid: 0 };
  await processStripeEvent(
    {
      ...event,
      id: 'evt_mail_failed',
      type: 'invoice.payment_failed',
      data: { object: failed },
    } as unknown as import('stripe').default.Event,
    fake,
  );
  rows = await db()
    .select()
    .from(s.mailDeliveries)
    .where(eq(s.mailDeliveries.dedupeKey, 'payment-failed:invoice_failed_mail:1'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'held');
  sub.status = 'active';
  sub.latest_invoice.status = 'paid';
  await processStripeEvent(
    {
      ...event,
      id: 'evt_mail_recovered',
      data: { object: { ...failed, status: 'paid', amount_paid: 1000 } },
    } as unknown as import('stripe').default.Event,
    fake,
  );
  assert.equal(await billingMailValid(other, 'payment_failed', rows[0].context, now), false);
});

test('System history stores no authentication links and respects early delivery webhooks without status regression', async () => {
  const { recordSystemMail } = await import('../src/lib/mail-log');
  await db()
    .insert(s.emailEvents)
    .values({
      id: 'evt-early-system-delivery',
      providerId: 'early-system-provider',
      status: 'email.delivered',
    });
  await recordSystemMail(
    client,
    'verification',
    'hashed-auth-request',
    'recipient@example.invalid',
    'accepted',
    'early-system-provider',
  );
  let records = await db()
    .select()
    .from(s.mailDeliveries)
    .where(eq(s.mailDeliveries.providerId, 'early-system-provider'));
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'delivered');
  await recordSystemMail(
    client,
    'verification',
    'hashed-auth-request',
    'recipient@example.invalid',
    'unknown',
    undefined,
    'EMAIL_TRANSPORT_UNCONFIRMED',
  );
  records = await db()
    .select()
    .from(s.mailDeliveries)
    .where(eq(s.mailDeliveries.providerId, 'early-system-provider'));
  assert.equal(records[0].status, 'delivered');
  const campaign = (
    await db().select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, records[0].campaignId))
  )[0];
  assert.ok(!JSON.stringify(campaign).includes('token='));
  assert.equal(campaign.template, 'verification');
});
