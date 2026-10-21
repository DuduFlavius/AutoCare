import { and, eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { effectiveRole } from './permissions';
import { db } from './db';
import * as s from './schema';
import { AppError, profile, assertActiveAccount, detectMime } from './service';
export const staffRoles = ['assistant', 'admin', 'founder'] as const;
export function isSupportStaff(role: string) {
  return (staffRoles as readonly string[]).includes(role);
}
export const roleLabel = (role: string) =>
  ({
    assistant: 'Asistent',
    admin: 'Administrator',
    founder: 'Fondator',
    system: 'Sistem',
    user: 'Client',
  })[role] || 'Client';
async function actor(uid: string) {
  await assertActiveAccount(uid);
  const [p, users] = await Promise.all([
    profile(uid),
    db().select({ name: s.user.name }).from(s.user).where(eq(s.user.id, uid)),
  ]);
  if (!users[0]) throw new AppError(401, 'Autentificarea este necesară.');
  return {
    uid,
    name: users[0].name,
    role: isSupportStaff(p.role) ? p.role : 'user',
    staff: isSupportStaff(p.role),
  };
}
async function threadFor(uid: string, id: string) {
  const who = await actor(uid);
  const thread = (await db().select().from(s.supportThreads).where(eq(s.supportThreads.id, id)))[0];
  if (!thread || (!who.staff && (thread.userId !== uid || thread.status === 'trashed')))
    throw new AppError(404, 'Conversație inexistentă.');
  return { who, thread };
}
export async function listSupportThreads(uid: string, status = 'open') {
  const who = await actor(uid);
  const state = z.enum(['open', 'completed', 'trashed']).parse(status);
  const threads = await db()
    .select({
      id: s.supportThreads.id,
      title: s.supportThreads.title,
      status: s.supportThreads.status,
      userId: s.supportThreads.userId,
      updatedAt: s.supportThreads.updatedAt,
      createdAt: s.supportThreads.createdAt,
      assignedTo: s.supportThreads.assignedTo,
      workingAt: s.supportThreads.workingAt,
      unreadCount: sql<number>`(SELECT count(*)::int FROM support_chat_messages m WHERE m."threadId"=${s.supportThreads.id} AND m."authorId" IS DISTINCT FROM ${uid} AND m."createdAt">coalesce((SELECT r."lastReadAt" FROM support_reads r WHERE r."threadId"=${s.supportThreads.id} AND r."userId"=${uid}),'epoch'::timestamptz))`,
      name: s.user.name,
      email: s.user.email,
    })
    .from(s.supportThreads)
    .innerJoin(s.user, eq(s.user.id, s.supportThreads.userId))
    .where(
      who.staff
        ? eq(s.supportThreads.status, state)
        : and(eq(s.supportThreads.userId, uid), sql`${s.supportThreads.status}<>'trashed'`),
    )
    .orderBy(desc(s.supportThreads.updatedAt), desc(s.supportThreads.id))
    .limit(200);
  const counts = who.staff
    ? await db()
        .select({ status: s.supportThreads.status, n: sql<number>`count(*)::int` })
        .from(s.supportThreads)
        .groupBy(s.supportThreads.status)
    : [];
  return {
    threads,
    counts: Object.fromEntries(counts.map((x) => [x.status, x.n])),
    role: who.role,
  };
}
export async function readSupportThread(uid: string, id: string, cursor?: string) {
  const { who, thread } = await threadFor(uid, id);
  let before;
  if (cursor) {
    before = (
      await db()
        .select()
        .from(s.supportChatMessages)
        .where(and(eq(s.supportChatMessages.id, cursor), eq(s.supportChatMessages.threadId, id)))
    )[0];
    if (!before) throw new AppError(400, 'Cursor invalid.');
  }
  const messages = await db()
    .select()
    .from(s.supportChatMessages)
    .where(
      and(
        eq(s.supportChatMessages.threadId, id),
        before
          ? sql`(${s.supportChatMessages.createdAt},${s.supportChatMessages.id}) < (${before.createdAt},${before.id})`
          : undefined,
      ),
    )
    .orderBy(desc(s.supportChatMessages.createdAt), desc(s.supportChatMessages.id))
    .limit(101);
  const hasMore = messages.length > 100;
  const [attachments, receipts] = await Promise.all([
    db()
      .select({
        id: s.supportChatFiles.id,
        messageId: s.supportChatFiles.messageId,
        name: s.supportChatFiles.name,
        mime: s.supportChatFiles.mime,
        size: s.supportChatFiles.size,
      })
      .from(s.supportChatFiles)
      .where(eq(s.supportChatFiles.threadId, id)),
    db()
      .select({ userId: s.supportReads.userId, lastReadAt: s.supportReads.lastReadAt })
      .from(s.supportReads)
      .where(eq(s.supportReads.threadId, id)),
  ]);
  return {
    thread,
    messages: messages.slice(0, 100).reverse(),
    hasMore,
    role: who.role,
    attachments,
    receipts,
  };
}
export async function joinSupportThread(uid: string, id: string) {
  const who = await actor(uid);
  if (!who.staff) throw new AppError(403, 'Acțiunea este disponibilă echipei de suport.');
  return db().transaction(async (tx) => {
    const thread = (
      await tx.select().from(s.supportThreads).where(eq(s.supportThreads.id, id)).for('update')
    )[0];
    if (!thread) throw new AppError(404, 'Conversație inexistentă.');
    if (thread.status !== 'open') throw new AppError(409, 'Conversația nu este activă.');
    if (thread.assignedTo && thread.assignedTo !== uid) throw new AppError(409, 'Conversația este preluată de alt coleg.');
    if (!thread.assignedTo) await tx.update(s.supportThreads).set({ assignedTo: uid, workingAt: new Date() }).where(eq(s.supportThreads.id, id));
    const joined = await tx
      .insert(s.supportParticipants)
      .values({ threadId: id, userId: uid })
      .onConflictDoNothing()
      .returning();
    if (joined.length) {
      const title = { assistant: 'Asistentul', admin: 'Administratorul', founder: 'Fondatorul' }[
        who.role as 'assistant' | 'admin' | 'founder'
      ];
      await tx.insert(s.supportChatMessages).values({
        id: crypto.randomUUID(),
        threadId: id,
        authorId: uid,
        authorName: who.name,
        authorRole: 'system',
        body: `Bună ziua! ${title} ${who.name} a intrat în chat.`,
      });
      await tx
        .update(s.supportThreads)
        .set({ updatedAt: new Date(), workingAt: thread.workingAt || new Date() })
        .where(eq(s.supportThreads.id, id));
    }
    return { ok: true, announced: !!joined.length };
  });
}
export async function sendSupportMessage(uid: string, input: unknown) {
  const data = z
    .object({
      conversationId: z.string().min(1).max(100).optional(),
      message: z.string().trim().min(1).max(4000),
    })
    .strict()
    .parse(input);
  const who = await actor(uid);
  if (who.staff && !data.conversationId) throw new AppError(400, 'Selectează o conversație.');
  if (who.staff && data.conversationId) await joinSupportThread(uid, data.conversationId);
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, uid)).for('update');
    let thread = data.conversationId
      ? (
          await tx
            .select()
            .from(s.supportThreads)
            .where(eq(s.supportThreads.id, data.conversationId))
            .for('update')
        )[0]
      : (
          await tx
            .select()
            .from(s.supportThreads)
            .where(and(eq(s.supportThreads.userId, uid), eq(s.supportThreads.status, 'open')))
            .orderBy(desc(s.supportThreads.updatedAt))
            .limit(1)
            .for('update')
        )[0];
    if (data.conversationId && (!thread || (!who.staff && thread.userId !== uid)))
      throw new AppError(404, 'Conversație inexistentă.');
    if (thread && thread.status !== 'open')
      throw new AppError(409, 'Conversația este finalizată. Deschide o solicitare nouă.');
    if (who.staff && thread?.assignedTo !== uid) throw new AppError(409, 'Conversația este atribuită altui coleg.');
    if (!thread)
      thread = (
        await tx
          .insert(s.supportThreads)
          .values({ id: crypto.randomUUID(), userId: uid, title: data.message.slice(0, 80) })
          .returning()
      )[0];
    const message = (
      await tx
        .insert(s.supportChatMessages)
        .values({
          id: crypto.randomUUID(),
          threadId: thread.id,
          authorId: uid,
          authorName: who.name,
          authorRole: who.role,
          body: data.message,
        })
        .returning()
    )[0];
    await tx
      .update(s.supportThreads)
      .set({ updatedAt: new Date() })
      .where(eq(s.supportThreads.id, thread.id));
    return { threadId: thread.id, message };
  });
}
export async function changeSupportThread(uid: string, id: string, input: unknown) {
  const { action } = z
    .object({ action: z.enum(['complete', 'trash', 'restore', 'reopen']) })
    .strict()
    .parse(input);
  const who = await actor(uid);
  if (!who.staff) throw new AppError(403, 'Doar echipa poate administra conversațiile.');
  return db().transaction(async (tx) => {
    const thread = (
      await tx.select().from(s.supportThreads).where(eq(s.supportThreads.id, id)).for('update')
    )[0];
    if (!thread) throw new AppError(404, 'Conversație inexistentă.');
    const expected = {
      complete: 'open',
      trash: 'completed',
      restore: 'trashed',
      reopen: 'completed',
    }[action];
    if (thread.status !== expected)
      throw new AppError(409, 'Starea conversației s-a schimbat. Reîncarcă lista.');
    const status = {
      complete: 'completed',
      trash: 'trashed',
      restore: 'completed',
      reopen: 'open',
    }[action];
    const now = new Date();
    const updated = (
      await tx
        .update(s.supportThreads)
        .set({
          status,
          updatedAt: now,
          completedAt:
            action === 'complete' ? now : action === 'reopen' ? null : thread.completedAt,
          trashedAt: action === 'trash' ? now : null,
        })
        .where(eq(s.supportThreads.id, id))
        .returning()
    )[0];
    await tx.insert(s.supportChatMessages).values({
      id: crypto.randomUUID(),
      threadId: id,
      authorId: uid,
      authorName: who.name,
      authorRole: 'system',
      body:
        {
          complete: 'Conversația a fost finalizată',
          trash: 'Conversația a fost mutată în coșul de gunoi',
          restore: 'Conversația a fost restaurată',
          reopen: 'Conversația a fost redeschisă',
        }[action] + ` de ${roleLabel(who.role).toLowerCase()} ${who.name}.`,
    });
    await tx
      .update(s.support)
      .set({ status: action === 'reopen' ? 'open' : 'closed' })
      .where(eq(s.support.id, id));
    await tx
      .insert(s.audit)
      .values({ id: crypto.randomUUID(), actorId: uid, action: 'support.' + action, target: id });
    return updated;
  });
}

export async function supportTeam(uid: string) {
  const who = await actor(uid);
  if (!who.staff) throw new AppError(403, 'Acces rezervat echipei.');
  const rows = await db()
    .select({ id: s.user.id, name: s.user.name, role: s.profiles.role })
    .from(s.user)
    .leftJoin(s.profiles, eq(s.profiles.userId, s.user.id))
    .where(
      process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true'
        ? eq(s.user.emailVerified, true)
        : undefined,
    );
  const team = rows
    .map((r) => ({ ...r, role: effectiveRole(r.id, r.role || 'user') }))
    .filter((r) => isSupportStaff(r.role) && (who.role !== 'assistant' || r.id === uid));
  return { selfId: uid, team };
}
export async function assignSupportThread(uid: string, id: string, input: unknown) {
  const who = await actor(uid);
  if (!who.staff) throw new AppError(403, 'Acces rezervat echipei.');
  const { assigneeId } = z.object({ assigneeId: z.string().nullable() }).strict().parse(input);
  if (who.role === 'assistant' && assigneeId !== uid)
    throw new AppError(403, 'Asistenții pot prelua doar propriile solicitări.');
  let assignee: Awaited<ReturnType<typeof actor>> | null = null;
  if (assigneeId) {
    assignee = await actor(assigneeId);
    if (!assignee.staff) throw new AppError(400, 'Utilizatorul nu are rol de suport.');
  }
  return db().transaction(async (tx) => {
    const thread = (
      await tx.select().from(s.supportThreads).where(eq(s.supportThreads.id, id)).for('update')
    )[0];
    if (!thread) throw new AppError(404, 'Conversație inexistentă.');
    if (thread.status !== 'open') throw new AppError(409, 'Conversația nu este activă.');
    if (thread.assignedTo && thread.assignedTo !== uid)
      throw new AppError(403, 'Solicitarea este deja atribuită altui coleg.');
    await tx
      .update(s.supportThreads)
      .set({
        assignedTo: assigneeId,
        workingAt: assigneeId ? thread.workingAt || new Date() : thread.workingAt,
        updatedAt: new Date(),
      })
      .where(eq(s.supportThreads.id, id));
    await tx.insert(s.supportChatMessages).values({
      id: crypto.randomUUID(),
      threadId: id,
      authorId: uid,
      authorName: who.name,
      authorRole: 'system',
      body: assignee
        ? `Conversația a fost atribuită: ${roleLabel(assignee.role)} · ${assignee.name}.`
        : 'Atribuirea conversației a fost eliminată.',
    });
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: 'support.assigned',
      target: id + ':' + (assigneeId || 'none'),
    });
    return { ok: true };
  });
}
export async function markSupportRead(uid: string, id: string, input: unknown) {
  await threadFor(uid, id);
  const { messageId } = z
    .object({ messageId: z.string().min(1).max(100) })
    .strict()
    .parse(input);
  const message = (
    await db()
      .select({ id: s.supportChatMessages.id })
      .from(s.supportChatMessages)
      .where(and(eq(s.supportChatMessages.id, messageId), eq(s.supportChatMessages.threadId, id)))
  )[0];
  if (!message) throw new AppError(404, 'Mesaj inexistent.');
  await db()
    .insert(s.supportReads)
    .values({
      threadId: id,
      userId: uid,
      lastReadAt: sql`(SELECT "createdAt" FROM support_chat_messages WHERE id=${messageId})`,
    })
    .onConflictDoUpdate({
      target: [s.supportReads.threadId, s.supportReads.userId],
      set: {
        lastReadAt: sql`greatest(${s.supportReads.lastReadAt},(SELECT "createdAt" FROM support_chat_messages WHERE id=${messageId}))`,
      },
    });
  return { ok: true };
}
export async function supportUnread(uid: string) {
  const who = await actor(uid);
  const rows = await db().execute(
    sql`SELECT count(*)::int AS n FROM support_chat_messages m JOIN support_threads t ON t.id=m."threadId" LEFT JOIN support_reads r ON r."threadId"=t.id AND r."userId"=${uid} WHERE t.status<>'trashed' AND (${who.staff} OR t."userId"=${uid}) AND m."authorId" IS DISTINCT FROM ${uid} AND m."createdAt">coalesce(r."lastReadAt",'epoch'::timestamptz)`,
  );
  return { unread: Number(rows.rows[0]?.n || 0) };
}
export async function attachSupportFile(
  uid: string,
  id: string,
  file: { name: string; bytes: Buffer },
) {
  const { who } = await threadFor(uid, id);
  if (file.bytes.length < 1 || file.bytes.length > 2097152)
    throw new AppError(413, 'Fișierele pot avea maximum 2 MB.');
  const mime = detectMime(file.bytes);
  if (who.staff) await joinSupportThread(uid, id);
  return db().transaction(async (tx) => {
    const thread = (
      await tx.select().from(s.supportThreads).where(eq(s.supportThreads.id, id)).for('update')
    )[0];
    if (thread.status !== 'open') throw new AppError(409, 'Conversația nu este activă.');
    const count = (
      await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(s.supportChatFiles)
        .where(eq(s.supportChatFiles.threadId, id))
    )[0].n;
    if (count >= 20) throw new AppError(400, 'Conversația permite maximum 20 de atașamente.');
    const name = file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150) || 'document';
    const messageId = crypto.randomUUID();
    await tx.insert(s.supportChatMessages).values({
      id: messageId,
      threadId: id,
      authorId: uid,
      authorName: who.name,
      authorRole: who.role,
      body: 'Atașament: ' + name,
    });
    const { data: _data, ...metadata } = (
      await tx
        .insert(s.supportChatFiles)
        .values({
          id: crypto.randomUUID(),
          threadId: id,
          messageId,
          authorId: uid,
          name,
          mime,
          data: file.bytes.toString('base64'),
          size: file.bytes.length,
        })
        .returning()
    )[0];
    await tx
      .update(s.supportThreads)
      .set({ updatedAt: new Date() })
      .where(eq(s.supportThreads.id, id));
    return metadata;
  });
}
export async function getSupportFile(uid: string, id: string) {
  const file = (
    await db().select().from(s.supportChatFiles).where(eq(s.supportChatFiles.id, id))
  )[0];
  if (!file) throw new AppError(404, 'Atașament inexistent.');
  await threadFor(uid, file.threadId);
  return file;
}
