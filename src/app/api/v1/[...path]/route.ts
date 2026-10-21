import { revalidatePath, revalidateTag } from 'next/cache';
import { filterRecords } from '@/lib/record-filters';
import * as founder from '@/lib/founder';
import { pricing, savings } from '@/lib/pricing';
import * as supportChat from '@/lib/support-chat';
import { emailWebhook } from '@/lib/email-events';
import { and, eq, desc, sql, isNull } from 'drizzle-orm';
import { ZodError, z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import * as s from '@/lib/schema';
import * as svc from '@/lib/service';
import { origin } from '@/lib/config';
import { runJob, sendPushNotification } from '@/lib/reminders';
import { sendMail } from '@/lib/mail';
import { stripe, checkout, billingPortal, processStripeEvent } from '@/lib/billing';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
const uuid = z.string().uuid();
async function rate(uid: string) {
  const key = `api:${uid}:${Math.floor(Date.now() / 60000)}`;
  const out = await db()
    .insert(s.requestLimits)
    .values({ key, window: new Date() })
    .onConflictDoUpdate({
      target: s.requestLimits.key,
      set: { count: sql`${s.requestLimits.count}+1` },
    })
    .returning();
  if (out[0].count > 90)
    throw new svc.AppError(429, 'Prea multe cereri. Reîncearcă într-un minut.');
}
function secret(req: Request) {
  const value = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return (
    !!process.env.CRON_SECRET &&
    value.length === expected.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
async function bounded(req: Request, max: number) {
  if (Number(req.headers.get('content-length') || 0) > max)
    throw new svc.AppError(413, 'Cerere prea mare.');
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new svc.AppError(413, 'Cerere prea mare.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function body(req: Request) {
  return JSON.parse(Buffer.from(await bounded(req, 65536)).toString('utf8'));
}
async function form(req: Request) {
  const bytes = await bounded(req, 2200000);
  return new Response(bytes, {
    headers: { 'Content-Type': req.headers.get('content-type') || '' },
  }).formData();
}
async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await ctx.params).path;
    const route = path.join('/');
    const method = req.method;
    if (route === 'jobs/reminders' && method === 'GET') {
      if (!secret(req)) return json({ error: 'Neautorizat' }, 401);
      return json(await runJob());
    }
    if (route === 'email/webhook' && method === 'POST') {
      const raw = Buffer.from(await bounded(req, 1048576)).toString('utf8');
      if (raw.length > 65536) throw new svc.AppError(413, 'Cerere prea mare.');
      return json(await emailWebhook(raw, req.headers));
    }
    if (route === 'billing/webhook' && method === 'POST') {
      const sig = req.headers.get('stripe-signature');
      if (!sig || !process.env.STRIPE_WEBHOOK_SECRET)
        return json({ error: 'Webhook neconfigurat' }, 400);
      const raw = Buffer.from(await bounded(req, 1048576)).toString('utf8');
      if (raw.length > 1024 * 1024) return json({ error: 'Cerere prea mare' }, 413);
      let event;
      try {
        event = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch {
        return json({ error: 'Semnătură invalidă' }, 400);
      }
      return json(await processStripeEvent(event, stripe()));
    }
    if (route === 'pricing' && method === 'GET') {
      const p = await pricing();
      return json({
        monthlyBani: p.monthlyBani,
        annualBani: p.annualBani,
        currency: p.currency,
        ...savings(p.monthlyBani, p.annualBani),
      });
    }
    if (method !== 'GET' && req.headers.get('origin') !== origin())
      return json({ error: 'Origine invalidă' }, 403);
    const sess = await auth().api.getSession({ headers: req.headers });
    if (
      !sess?.user ||
      (process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true' && !sess.user.emailVerified)
    )
      return json({ error: 'Autentifică-te și confirmă emailul.' }, 401);
    const uid = sess.user.id;
    await svc.assertActiveAccount(uid);
    await rate(uid);
    if (path[0] === 'founder') {
      if (route === 'founder/seo' && method === 'GET') return json(await founder.founderSeo(uid));
      if (route === 'founder/seo' && method === 'PUT') {
        const result = await founder.saveFounderSeo(uid, await body(req));
        revalidateTag('autocare-google-verification', { expire: 0 });
        revalidatePath('/');
        return json(result);
      }
      if (route === 'founder/team' && method === 'POST')
        return json(await founder.addTeamMember(uid, await body(req)));
      if (route === 'founder/overview' && method === 'GET')
        return json(await founder.founderOverview(uid));
      if (route === 'founder/users' && method === 'GET')
        return json(await founder.founderUsers(uid, new URL(req.url).searchParams));
      if (path[1] === 'users' && path[2]) {
        const id = path[2];
        if (path.length === 3 && method === 'GET')
          return json(await founder.founderUserDetail(uid, id));
        if (path[3] === 'role' && method === 'POST')
          return json(await founder.changeRole(uid, id, await body(req)));
        if (path[3] === 'premium' && method === 'POST')
          return json(await founder.grantPremium(uid, id, await body(req)));
        if (path[3] === 'premium' && method === 'DELETE')
          return json(await founder.revokePremium(uid, id, await body(req)));
        if (path[3] === 'access' && method === 'POST')
          return json(await founder.suspendAccount(uid, id, await body(req)));
      }
      if (route === 'founder/pricing' && method === 'POST')
        return json(await founder.changePricing(uid, await body(req)));
      if (route === 'founder/audit' && method === 'GET')
        return json(await founder.founderAudit(uid, new URL(req.url).searchParams));
      await founder.requireFounder(uid);
      return json({ error: 'Rută inexistentă.' }, 404);
    }
    if (route === 'dashboard' && method === 'GET') return json(await svc.dashboard(uid));
    if (route === 'notifications/read' && method === 'POST') {
      await db()
        .update(s.notifications)
        .set({ readAt: new Date() })
        .where(and(eq(s.notifications.userId, uid), isNull(s.notifications.readAt)));
      return json({ ok: true });
    }
    if (
      path.length === 3 &&
      path[0] === 'notifications' &&
      path[2] === 'read' &&
      method === 'PATCH'
    ) {
      const id = uuid.parse(path[1]);
      const input = z.object({ read: z.boolean() }).parse(await body(req));
      const updated = await db()
        .update(s.notifications)
        .set({ readAt: input.read ? new Date() : null })
        .where(and(eq(s.notifications.id, id), eq(s.notifications.userId, uid)))
        .returning({ id: s.notifications.id });
      if (!updated.length) throw new svc.AppError(404, 'Notificare inexistentă.');
      return json({ ok: true });
    }

    if (path[0] === 'vehicles' && path[2] === 'photo') {
      const id = uuid.parse(path[1]);
      await svc.ownedVehicle(uid, id);
      if (method === 'POST') {
        if (Number(req.headers.get('content-length') || 0) > 2200000)
          throw new svc.AppError(413, 'Maximum 2 MB.');
        const photoForm = await form(req);
        const file = photoForm.get('file');
        if (!(file instanceof File) || file.size > 2097152)
          throw new svc.AppError(400, 'Fotografie invalidă (maximum 2 MB).');
        await svc.uploadVehiclePhoto(uid, id, Buffer.from(await file.arrayBuffer()));
        return json({ ok: true });
      }
      if (method === 'GET') {
        const photo = (
          await db()
            .select()
            .from(s.vehiclePhotos)
            .where(and(eq(s.vehiclePhotos.vehicleId, id), eq(s.vehiclePhotos.userId, uid)))
        )[0];
        if (!photo) throw new svc.AppError(404, 'Fotografie inexistentă.');
        return new Response(Buffer.from(photo.data, 'base64'), {
          headers: {
            'Content-Type': photo.mime,
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }
    if (path[0] === 'vehicles') {
      if (method === 'POST' && path.length === 1)
        return json(await svc.createVehicle(uid, await body(req)), 201);
      if (method === 'PATCH' && path.length === 2)
        return json(await svc.editVehicle(uid, uuid.parse(path[1]), await body(req)));
      if (method === 'DELETE' && path.length === 2) {
        await svc.archiveVehicle(uid, uuid.parse(path[1]));
        return json({ ok: true });
      }
    }
    if (path[0] === 'records') {
      if (method === 'POST' && path.length === 1)
        return json(await svc.saveRecord(uid, await body(req)), 201);
      if (method === 'PATCH' && path.length === 2)
        return json(await svc.saveRecord(uid, await body(req), uuid.parse(path[1])));
      if (method === 'DELETE' && path.length === 2) {
        await svc.archiveRecord(uid, uuid.parse(path[1]));
        return json({ ok: true });
      }
      if (method === 'GET' && path[2] === 'history') {
        await svc.ownedRecord(uid, uuid.parse(path[1]));
        return json(
          await db()
            .select()
            .from(s.recordHistory)
            .where(and(eq(s.recordHistory.userId, uid), eq(s.recordHistory.recordId, path[1])))
            .orderBy(desc(s.recordHistory.createdAt)),
        );
      }
    }
    if (route === 'profile' && method === 'PUT') {
      await svc.saveProfile(uid, await body(req));
      return json({ ok: true });
    }
    if (route === 'files' && method === 'POST') {
      if (Number(req.headers.get('content-length') || 0) > 2200000)
        throw new svc.AppError(413, 'Maximum 2 MB.');
      const f = await form(req);
      const file = f.get('file');
      if (!(file instanceof File)) throw new svc.AppError(400, 'Alege un fișier.');
      if (file.size > 2097152) throw new svc.AppError(413, 'Maximum 2 MB.');
      return json(
        await svc.uploadFile(uid, uuid.parse(f.get('recordId')), {
          name: file.name,
          bytes: Buffer.from(await file.arrayBuffer()),
        }),
        201,
      );
    }
    if (path[0] === 'files' && path.length === 2) {
      const file = await svc.getFile(uid, uuid.parse(path[1]));
      if (method === 'GET')
        return new Response(Buffer.from(file.data, 'base64'), {
          headers: {
            'Content-Type': file.mime,
            'Content-Disposition': `${new URL(req.url).searchParams.get('view') === '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      if (method === 'DELETE') {
        await db()
          .delete(s.files)
          .where(and(eq(s.files.userId, uid), eq(s.files.id, file.id)));
        return json({ ok: true });
      }
    }
    if (route === 'push/test' && method === 'POST') {
      await sendPushNotification(uid, {
        id: crypto.randomUUID(),
        title: 'AutoCare · Notificări activate',
        body: 'Notificările AutoCare funcționează pe acest dispozitiv. Drum bun!',
      });
      return json({ ok: true, status: 'accepted' });
    }
    if (route === 'push' && method === 'POST') {
      const p = z
        .object({
          endpoint: z
            .string()
            .url()
            .max(2000)
            .refine((x) => {
              const u = new URL(x);
              return (
                u.protocol === 'https:' &&
                !u.port &&
                [
                  'fcm.googleapis.com',
                  'updates.push.services.mozilla.com',
                  'web.push.apple.com',
                ].some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
              );
            }),
          keys: z.object({
            p256dh: z
              .string()
              .regex(/^[\w-]+$/)
              .max(200),
            auth: z
              .string()
              .regex(/^[\w-]+$/)
              .max(100),
          }),
        })
        .parse(await body(req));
      await db()
        .insert(s.pushes)
        .values({ ...p, id: crypto.randomUUID(), userId: uid })
        .onConflictDoUpdate({ target: s.pushes.endpoint, set: { userId: uid, keys: p.keys } });
      return json({ ok: true });
    }
    if (route === 'push' && method === 'DELETE') {
      await db().delete(s.pushes).where(eq(s.pushes.userId, uid));
      return json({ ok: true });
    }
    if (route === 'export' && method === 'GET') {
      const data = await svc.dashboard(uid);
      const format = new URL(req.url).searchParams.get('format');
      if (format === 'json') {
        const support = await db().select().from(s.support).where(eq(s.support.userId, uid));
        const supportThreads = await db()
          .select()
          .from(s.supportThreads)
          .where(eq(s.supportThreads.userId, uid));
        const supportMessages = await db()
          .select({
            id: s.supportChatMessages.id,
            threadId: s.supportChatMessages.threadId,
            authorName: s.supportChatMessages.authorName,
            authorRole: s.supportChatMessages.authorRole,
            body: s.supportChatMessages.body,
            createdAt: s.supportChatMessages.createdAt,
          })
          .from(s.supportChatMessages)
          .innerJoin(s.supportThreads, eq(s.supportThreads.id, s.supportChatMessages.threadId))
          .where(eq(s.supportThreads.userId, uid));
        const history = await db()
          .select()
          .from(s.recordHistory)
          .where(eq(s.recordHistory.userId, uid));
        const attachments = await db().select().from(s.files).where(eq(s.files.userId, uid));
        const invoices = await db().select().from(s.invoices).where(eq(s.invoices.userId, uid));
        const photos = await db()
          .select()
          .from(s.vehiclePhotos)
          .where(eq(s.vehiclePhotos.userId, uid));
        const sessions = await db()
          .select({
            id: s.session.id,
            createdAt: s.session.createdAt,
            expiresAt: s.session.expiresAt,
            ipAddress: s.session.ipAddress,
            userAgent: s.session.userAgent,
          })
          .from(s.session)
          .where(eq(s.session.userId, uid));
        const pushSubscriptions = await db()
          .select({ endpoint: s.pushes.endpoint })
          .from(s.pushes)
          .where(eq(s.pushes.userId, uid));
        return new Response(
          JSON.stringify(
            {
              user: { name: sess.user.name, email: sess.user.email },
              ...data,
              support,
              supportThreads,
              supportMessages,
              history,
              attachments,
              invoices,
              photos,
              sessions,
              pushSubscriptions,
            },
            null,
            2,
          ),
          {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': 'attachment; filename="autocare-date-personale.json"',
              'Cache-Control': 'no-store',
            },
          },
        );
      }
      if (!data.premium)
        throw new svc.AppError(
          403,
          'Exportul rapoartelor necesită Premium. Exportul datelor personale JSON este gratuit.',
        );
      const params = new URL(req.url).searchParams;
      const filters = z
        .object({
          kind: z.enum(['document', 'service', 'expense']).optional(),
          vehicleId: z.string().uuid().optional(),
          category: z.string().max(250).optional(),
          status: z.enum(['valid', 'soon', 'expired', 'incomplete', 'archived']).optional(),
          archived: z.enum(['all', 'active', 'only']).optional(),
          q: z.string().max(250).optional(),
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .parse(
          Object.fromEntries(Array.from(params.entries()).filter(([key]) => key !== 'format')),
        );
      const selected = filterRecords(data.records, filters, new Date(), data.profile.timezone);
      const rows = selected.map(
        ({
          id,
          vehicleId,
          kind,
          category,
          title,
          date,
          expiresAt,
          odometer,
          amountBani,
          amountKnown,
        }) => ({
          id,
          vehicleId,
          kind,
          category,
          title,
          date,
          expiresAt,
          odometer,
          amountBani: amountKnown === false ? null : amountBani,
          amountKnown,
        }),
      );
      if (format === 'pdf') {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        let page = doc.addPage();
        let y = 790;
        const clean = (v: string) =>
          v
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7E]/g, '?');
        for (const line of [
          'AutoCare - Raport personal',
          'Sume in RON; date introduse de utilizator.',
          ...rows.map(
            (r) =>
              `${r.date || '-'} | ${r.title} | ${r.amountBani === null ? 'Cost necunoscut' : (r.amountBani / 100).toFixed(2) + ' RON'}`,
          ),
        ]) {
          if (y < 40) {
            page = doc.addPage();
            y = 790;
          }
          page.drawText(clean(line).slice(0, 95), {
            x: 40,
            y,
            size: 10,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= 20;
        }
        return new Response(Buffer.from(await doc.save()), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="autocare-raport.pdf"',
            'Cache-Control': 'no-store',
          },
        });
      }
      return new Response(svc.csv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="autocare-istoric.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }
    if (route === 'account' && method === 'DELETE') {
      const data = z
        .object({ password: z.string().min(1), confirm: z.literal('ȘTERGE') })
        .parse(await body(req));
      const sub = (
        await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid))
      )[0];
      if (sub?.subscriptionId && ['active', 'past_due', 'trialing'].includes(sub.status))
        throw new svc.AppError(409, 'Anulează abonamentul înainte de ștergerea contului.');
      await auth().api.deleteUser({ headers: req.headers, body: { password: data.password } });
      return json({ ok: true });
    }
    if (route === 'billing/checkout' && method === 'POST')
      return json(
        await checkout(
          uid,
          z.object({ interval: z.enum(['monthly', 'annual']) }).parse(await body(req)).interval,
        ),
      );
    if (route === 'billing/portal' && method === 'POST') return json(await billingPortal(uid));
    if (route === 'billing/invoices' && method === 'GET')
      return json(
        await db()
          .select()
          .from(s.invoices)
          .where(eq(s.invoices.userId, uid))
          .orderBy(desc(s.invoices.createdAt)),
      );
    if (route === 'support/team' && method === 'GET')
      return json(await supportChat.supportTeam(uid));
    if (route === 'support/unread' && method === 'GET')
      return json(await supportChat.supportUnread(uid));
    if (path[0] === 'support' && path[1] === 'files' && path.length === 3 && method === 'GET') {
      const file = await supportChat.getSupportFile(uid, path[2]);
      return new Response(Buffer.from(file.data, 'base64'), {
        headers: {
          'Content-Type': file.mime,
          'Content-Disposition': `${new URL(req.url).searchParams.get('view') === '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex',
        },
      });
    }
    if (path[0] === 'support' && path[1] === 'chat') {
      if (path.length === 4 && path[3] === 'assign' && method === 'POST')
        return json(await supportChat.assignSupportThread(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'read' && method === 'POST')
        return json(await supportChat.markSupportRead(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'files' && method === 'POST') {
        const data = await form(req);
        const file = data.get('file');
        if (!(file instanceof File) || file.size > 2097152)
          throw new svc.AppError(400, 'Atașament invalid. Maximum 2 MB.');
        return json(
          await supportChat.attachSupportFile(uid, path[2], {
            name: file.name,
            bytes: Buffer.from(await file.arrayBuffer()),
          }),
          201,
        );
      }

      if (path.length === 2 && method === 'GET')
        return json(
          await supportChat.listSupportThreads(
            uid,
            new URL(req.url).searchParams.get('status') || 'open',
          ),
        );
      if (path.length === 2 && method === 'POST') {
        const result = await supportChat.sendSupportMessage(uid, await body(req));
        // Push is best-effort: never fail or duplicate a saved message because delivery failed.
        try {
          const messageResult = result as { threadId: string; message: { id: string } };
          const thread = (await db().select({
            userId: s.supportThreads.userId,
            assignedTo: s.supportThreads.assignedTo,
          }).from(s.supportThreads).where(eq(s.supportThreads.id, messageResult.threadId)))[0];
          if (thread) {
            const recipients = thread.userId === uid
              ? thread.assignedTo
                ? [thread.assignedTo]
                : (await db().select({ userId: s.profiles.userId, role: s.profiles.role }).from(s.profiles))
                    .filter((p) => supportChat.isSupportStaff(p.role)).map((p) => p.userId)
              : [thread.userId];
            const recipientIds = [...new Set(recipients)].filter((id) => id !== uid);
            const title = thread.userId === uid ? 'AutoCare · Mesaj nou pentru suport' : 'AutoCare · Răspuns de la suport';
            const bodyText = thread.userId === uid
              ? 'A sosit un mesaj nou în Centrul de suport.'
              : 'Echipa AutoCare ți-a răspuns în Centrul de suport.';
            const users = recipientIds.length
              ? await db().select({
                  id: s.user.id, email: s.user.email, verified: s.user.emailVerified,
                  emailEnabled: s.profiles.emailEnabled, pushEnabled: s.profiles.pushEnabled,
                }).from(s.user).innerJoin(s.profiles, eq(s.user.id, s.profiles.userId))
                  .where(sql`${s.user.id} IN (${sql.join(recipientIds.map((id) => sql`${id}`), sql`, `)})`)
              : [];
            await Promise.allSettled(users.flatMap((user) => {
              const tasks: Promise<unknown>[] = [];
              if (user.pushEnabled) tasks.push(sendPushNotification(user.id, {
                id: 'support-' + messageResult.message.id, title, body: bodyText,
              }));
              if (user.emailEnabled && user.verified) tasks.push(sendMail(
                user.email, title,
                bodyText + '\n\nDeschide AutoCare: https://autocare-garaj.vercel.app/cont?tab=Centru%20de%20suport\n\nPoți dezactiva notificările e-mail din Setări.',
                'support/' + messageResult.message.id + '/' + user.id,
              ));
              return tasks;
            }));
          }
        } catch { /* A push failure must not affect a successfully saved message. */ }
        return json(result, 201);
      }
      if (path.length === 3 && method === 'GET')
        return json(
          await supportChat.readSupportThread(
            uid,
            path[2],
            new URL(req.url).searchParams.get('cursor') || undefined,
          ),
        );
      if (path.length === 3 && method === 'PATCH')
        return json(await supportChat.changeSupportThread(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'join' && method === 'POST')
        return json(await supportChat.joinSupportThread(uid, path[2]));
    }
    if (route === 'support' && method === 'POST') {
      const input = z
        .object({ message: z.string().trim().min(10).max(4000) })
        .parse(await body(req));
      await db().transaction(async (tx) => {
        const id = crypto.randomUUID();
        await tx.insert(s.support).values({ id, userId: uid, ...input });
        await tx
          .insert(s.supportThreads)
          .values({ id, userId: uid, title: input.message.slice(0, 80) });
        await tx.insert(s.supportChatMessages).values({
          id: 'legacy-' + id,
          threadId: id,
          authorId: uid,
          authorName: sess.user.name,
          authorRole: 'user',
          body: input.message,
        });
      });
      return json({ ok: true });
    }
    if (path[0] === 'admin') {
      const p = await svc.profile(uid);
      if (!['admin', 'founder'].includes(p.role)) throw new svc.AppError(403, 'Acces interzis.');
      if (method === 'GET') {
        const [users, subscriptions, jobs, failed, messages, audit, totals, active, revenues] =
          await Promise.all([
            db()
              .select({
                id: s.user.id,
                name: s.user.name,
                email: s.user.email,
                createdAt: s.user.createdAt,
              })
              .from(s.user)
              .limit(200),
            db().select().from(s.subscriptions).limit(200),
            db().select().from(s.jobRuns).orderBy(desc(s.jobRuns.startedAt)).limit(30),
            db()
              .select({
                id: s.notifications.id,
                status: s.notifications.status,
                error: s.notifications.error,
                attempts: s.notifications.attempts,
                createdAt: s.notifications.createdAt,
              })
              .from(s.notifications)
              .where(eq(s.notifications.status, 'failed'))
              .limit(100),
            db().select().from(s.support).orderBy(desc(s.support.createdAt)).limit(100),
            db().select().from(s.audit).orderBy(desc(s.audit.createdAt)).limit(50),
            db()
              .select({ users: sql<number>`count(*)::int` })
              .from(s.user),
            db()
              .select({ active: sql<number>`count(distinct ${s.session.userId})::int` })
              .from(s.session)
              .where(
                sql`${s.session.expiresAt}>now() AND ${s.session.updatedAt}>now()-interval '30 days'`,
              ),
            db()
              .select({
                currency: s.invoices.currency,
                total: sql<number>`sum(${s.invoices.amountBani})::int`,
              })
              .from(s.invoices)
              .where(and(eq(s.invoices.status, 'paid'), eq(s.invoices.livemode, true)))
              .groupBy(s.invoices.currency),
          ]);
        return json({
          users,
          subscriptions,
          jobs,
          failed,
          messages,
          audit,
          totals: totals[0],
          active: active[0],
          revenues,
          limits: await svc.limits(),
        });
      }
      if (route === 'admin/limits' && method === 'PUT') {
        await founder.requireFounder(uid);
        const value = z
          .object({
            premiumCars: z.number().int().min(2).max(50),
            maxFiles: z.number().int().min(2).max(100),
          })
          .parse(await body(req));
        await db().transaction(async (tx) => {
          await tx
            .insert(s.settings)
            .values({ key: 'limits', value })
            .onConflictDoUpdate({ target: s.settings.key, set: { value } });
          await tx.insert(s.audit).values({
            id: crypto.randomUUID(),
            actorId: uid,
            action: 'limits.updated',
            target: 'plans',
          });
        });
        return json({ ok: true });
      }
      if (path[1] === 'support' && method === 'PATCH') {
        const id = uuid.parse(path[2]);
        await db().transaction(async (tx) => {
          await tx.update(s.support).set({ status: 'closed' }).where(eq(s.support.id, id));
          await tx
            .update(s.supportThreads)
            .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(s.supportThreads.id, id), eq(s.supportThreads.status, 'open')));
          await tx.insert(s.audit).values({
            id: crypto.randomUUID(),
            actorId: uid,
            action: 'support.closed',
            target: id,
          });
        });
        return json({ ok: true });
      }
    }
    return json({ error: 'Ruta nu există.' }, 404);
  } catch (e) {
    if (e instanceof ZodError)
      return json(
        { error: e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') },
        400,
      );
    if (e instanceof svc.AppError) return json({ error: e.message }, e.status);
    if (e instanceof SyntaxError) return json({ error: 'Cerere invalidă.' }, 400);
    const trace = crypto.randomUUID();
    console.error(
      JSON.stringify({ event: 'api_error', trace, type: e instanceof Error ? e.name : 'unknown' }),
    );
    return json(
      { error: 'Operațiunea nu a reușit. Verifică configurarea serviciilor.', trace },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
