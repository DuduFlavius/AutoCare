import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import * as s from '../src/lib/schema';
import * as chat from '../src/lib/support-chat';
process.env.LOCAL_DATABASE_PATH = 'memory';
const customer = crypto.randomUUID(),
  other = crypto.randomUUID(),
  founder = crypto.randomUUID(),
  admin = crypto.randomUUID(),
  assistant = crypto.randomUUID();
process.env.AUTOCARE_FOUNDER_USER_ID = founder;
let threadId: string;
const status = (code: number) => (e: unknown) =>
  !!e && typeof e === 'object' && 'status' in e && e.status === code;
before(async () => {
  await migrate();
  for (const [id, name, role] of [
    [customer, 'Client Unu', 'user'],
    [other, 'Client Doi', 'user'],
    [founder, 'Dudu Flavius', 'founder'],
    [admin, 'Ana Admin', 'admin'],
    [assistant, 'Mihai Suport', 'assistant'],
  ]) {
    await db()
      .insert(s.user)
      .values({ id, name, email: id + '@example.invalid', emailVerified: true });
    await db().insert(s.profiles).values({ userId: id, role });
  }
});
after(async () => {
  await closeLocalDb();
});
test('Support: messages persist, owner isolation, server rejects role injection', async () => {
  const out = await chat.sendSupportMessage(customer, {
    message: 'Bună ziua, am nevoie de ajutor.',
  });
  threadId = out.threadId;
  const opening = (await chat.readSupportThread(customer, threadId)).messages;
  assert.equal(opening[0].authorRole, 'system');
  assert.match(opening[0].body, /Bine ai venit, Client Unu,/);
  assert.deepEqual((await chat.listSupportThreads(customer)).self, {id:customer,name:'Client Unu',role:'user'});
  assert.equal(opening[1].authorRole, 'user');
  await assert.rejects(() => chat.readSupportThread(other, threadId), status(404));
  await assert.rejects(
    () =>
      chat.sendSupportMessage(other, { conversationId: threadId, message: 'Intrare neautorizată' }),
    status(404),
  );
  await assert.rejects(() =>
    chat.sendSupportMessage(customer, {
      conversationId: threadId,
      message: 'Un mesaj',
      role: 'founder',
    }),
  );
  const own = await chat.listSupportThreads(other);
  assert.equal(own.threads.length, 0);
});
test('Support: founder join announcement uses real name and is concurrent/idempotent', async () => {
  await Promise.all([
    chat.joinSupportThread(founder, threadId),
    chat.joinSupportThread(founder, threadId),
  ]);
  const history = await chat.readSupportThread(customer, threadId);
  assert.equal(
    history.messages.filter(
      (m) => m.body === 'Bună ziua! Fondatorul Dudu Flavius a intrat în chat.',
    ).length,
    1,
  );
  await chat.sendSupportMessage(founder, {
    conversationId: threadId,
    message: 'Bună ziua! Cu ce vă putem ajuta?',
  });
  const reply = (await chat.readSupportThread(customer, threadId)).messages.find(
    (m) => m.authorRole === 'founder',
  );
  assert.equal(reply?.authorName, 'Dudu Flavius');
  await assert.rejects(() => chat.joinSupportThread(customer, threadId), status(403));
  await assert.rejects(
    () => chat.sendSupportMessage(founder, { message: 'Mesaj fără conversație' }),
    status(400),
  );
});
test('Support: assistant and administrator announce their actual rank', async () => {
  const assistantCustomer = crypto.randomUUID();
  const adminCustomer = crypto.randomUUID();
  for (const id of [assistantCustomer, adminCustomer]) {
    await db().insert(s.user).values({ id, name: 'Client test rol', email: id + '@example.invalid', emailVerified: true });
    await db().insert(s.profiles).values({ userId: id, role: 'user' });
  }
  const assistantThread = (await chat.sendSupportMessage(assistantCustomer, { message: 'Solicitare asistent' })).threadId;
  await chat.joinSupportThread(assistant, assistantThread);
  await assert.rejects(() => chat.joinSupportThread(admin, assistantThread), status(409));
  const assistantMessages = (await chat.readSupportThread(assistantCustomer, assistantThread)).messages;
  assert.ok(assistantMessages.some(m => m.body === 'Bună ziua! Asistentul Mihai Suport a intrat în chat.'));
  await chat.sendSupportMessage(assistant, { conversationId: assistantThread, message: 'Verificăm solicitarea.' });
  assert.ok((await chat.readSupportThread(assistantCustomer, assistantThread)).messages.some(m => m.authorRole === 'assistant'));
  const adminThread = (await chat.sendSupportMessage(adminCustomer, { message: 'Solicitare administrator' })).threadId;
  await chat.joinSupportThread(admin, adminThread);
  assert.ok((await chat.readSupportThread(adminCustomer, adminThread)).messages.some(
    m => m.body === 'Bună ziua! Administratorul Ana Admin a intrat în chat.',
  ));
});
test('Support: owners can end conversations; reopening remains staff-only and trash is reversible', async () => {
  await assert.rejects(() => chat.changeSupportThread(customer, threadId, { action: 'reopen' }), status(403));
  await assert.rejects(() => chat.changeSupportThread(other, threadId, { action: 'complete' }), status(404));
  await chat.changeSupportThread(customer, threadId, { action: 'complete' });
  await assert.rejects(
    () =>
      chat.sendSupportMessage(customer, {
        conversationId: threadId,
        message: 'Mesaj după finalizare',
      }),
    status(409),
  );
  await chat.changeSupportThread(founder, threadId, { action: 'trash' });
  assert.equal((await chat.readSupportThread(customer, threadId)).thread.status, 'trashed');
  await assert.rejects(() => chat.readSupportThread(other, threadId), status(404));
  assert.equal((await chat.listSupportThreads(admin, 'trashed')).threads[0].id, threadId);
  const rowsBefore = (await chat.readSupportThread(admin, threadId)).messages.length;
  await chat.changeSupportThread(founder, threadId, { action: 'restore' });
  assert.equal((await chat.readSupportThread(customer, threadId)).thread.status, 'completed');
  assert.ok((await chat.readSupportThread(customer, threadId)).messages.length > rowsBefore);
  await chat.changeSupportThread(founder, threadId, { action: 'reopen' });
  assert.equal((await chat.readSupportThread(customer, threadId)).thread.status, 'open');
  assert.ok((await db().select().from(s.audit)).some((a) => a.action === 'support.trash'));
});
test('Support: a new customer message after completion starts a new thread, concurrent sends reuse it', async () => {
  await chat.changeSupportThread(founder, threadId, { action: 'complete' });
  const replies = await Promise.all([
    chat.sendSupportMessage(customer, { message: 'O solicitare nouă' }),
    chat.sendSupportMessage(customer, { message: 'Un detaliu suplimentar' }),
  ]);
  assert.equal(replies[0].threadId, replies[1].threadId);
  assert.notEqual(replies[0].threadId, threadId);
  assert.equal((await chat.readSupportThread(customer, threadId)).thread.status, 'completed');
  assert.equal((await chat.readSupportThread(customer, replies[0].threadId)).messages.length, 3);
});
test('Support: history pagination preserves tied timestamps without duplicates', async () => {
  const out = await chat.sendSupportMessage(other, { message: 'Conversație pentru paginare' });
  const time = new Date('2030-01-01T12:00:00Z');
  await db()
    .insert(s.supportChatMessages)
    .values(
      Array.from({ length: 110 }, (_, i) => ({
        id: crypto.randomUUID(),
        threadId: out.threadId,
        authorId: other,
        authorName: 'Client Doi',
        authorRole: 'user',
        body: 'Mesaj ' + i,
        createdAt: time,
      })),
    );
  const first = await chat.readSupportThread(other, out.threadId);
  assert.equal(first.messages.length, 100);
  assert.equal(first.hasMore, true);
  const second = await chat.readSupportThread(other, out.threadId, first.messages[0].id);
  assert.equal(second.messages.length, 12);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.messages, ...second.messages].map((m) => m.id)).size, 112);
  await assert.rejects(
    () => chat.readSupportThread(customer, threadId, first.messages[0].id),
    status(400),
  );
});
test('Support: legacy support import is lossless and rerunning migration does not duplicate', async () => {
  const id = crypto.randomUUID();
  await db()
    .insert(s.support)
    .values({ id, userId: customer, message: 'Solicitare veche păstrată', status: 'closed' });
  for (let i = 0; i < 2; i++) {
    await db().execute(sql`DELETE FROM autocare_migrations WHERE name='0005_0_support_threads.sql'`);
    await migrate();
  }
  const out = await chat.readSupportThread(customer, id);
  assert.equal(out.thread.status, 'completed');
  assert.equal(out.messages.length, 1);
  assert.equal(out.messages[0].body, 'Solicitare veche păstrată');
  await chat.changeSupportThread(admin, id, { action: 'reopen' });
  assert.equal((await db().select().from(s.support).where(eq(s.support.id, id)))[0].status, 'open');
  assert.equal((await db().select().from(s.support).where(eq(s.support.id, id))).length, 1);
});
test('Support: customer deletion cascades through their private conversations and messages', async () => {
  const out = await chat.listSupportThreads(other);
  const ids = out.threads.map((t) => t.id);
  await db().delete(s.user).where(eq(s.user.id, other));
  for (const id of ids) {
    assert.equal(
      (await db().select().from(s.supportThreads).where(eq(s.supportThreads.id, id))).length,
      0,
    );
    assert.equal(
      (
        await db()
          .select()
          .from(s.supportChatMessages)
          .where(eq(s.supportChatMessages.threadId, id))
      ).length,
      0,
    );
  }
});
test('Support: assignment, read markers and private attachments enforce permissions', async () => {
  const { threadId: id } = await chat.sendSupportMessage(customer, {
    message: 'Verificare fișier',
  });
  await assert.rejects(
    () => chat.assignSupportThread(customer, id, { assigneeId: admin }),
    status(403),
  );
  await chat.assignSupportThread(admin, id, { assigneeId: assistant });
  assert.equal((await chat.readSupportThread(admin, id)).thread.assignedTo, assistant);
  await assert.rejects(
    () => chat.assignSupportThread(assistant, id, { assigneeId: admin }),
    status(403),
  );
  const unread = await chat.supportUnread(assistant);
  assert.ok(unread.unread > 0);
  const messages = (await chat.readSupportThread(assistant, id)).messages;
  await chat.markSupportRead(assistant, id, { messageId: messages.at(-1)!.id });
  assert.equal(
    (await chat.listSupportThreads(assistant)).threads.find((t) => t.id === id)?.unreadCount,
    0,
  );
  const f = await chat.attachSupportFile(customer, id, {
    name: 'factura.pdf',
    bytes: Buffer.from('%PDF-1.4\nprivate document'),
  });
  assert.ok(f.id);
  assert.equal('data' in f, false);
  const detail = await chat.readSupportThread(customer, id);
  assert.equal(detail.attachments[0].id, f.id);
  const outsider = crypto.randomUUID();
  await db()
    .insert(s.user)
    .values({
      id: outsider,
      name: 'Străin',
      email: outsider + '@example.invalid',
      emailVerified: true,
    });
  await assert.rejects(() => chat.getSupportFile(outsider, f.id), status(404));
  assert.equal((await chat.getSupportFile(admin, f.id)).mime, 'application/pdf');
  await assert.rejects(() =>
    chat.attachSupportFile(customer, id, {
      name: 'script.html',
      bytes: Buffer.from('<script>alert(1)</script>'),
    }),
  );
});

test('Support: private operations, live typing, message search, transfer and satisfaction stay scoped', async () => {
  const client = crypto.randomUUID();
  const outsider = crypto.randomUUID();
  await db().insert(s.user).values({ id: outsider, name: 'Unrelated client', email: outsider + '@example.invalid' });
  await db().insert(s.user).values({ id: client, name: 'Operator QA client', email: client + '@example.invalid', emailVerified: true });
  const { threadId: id } = await chat.sendSupportMessage(client, { message: 'Primul mesaj pentru flux.' });
  await chat.sendSupportMessage(client, { conversationId: id, message: 'Al doilea mesaj conține codul CĂUTARE-TEST-92.' });
  assert.equal((await chat.listSupportThreads(admin, 'open', 'CĂUTARE-TEST-92')).threads[0].id, id);
  assert.equal((await chat.listSupportThreads(outsider, 'open', 'CĂUTARE-TEST-92')).threads.some(thread => thread.id === id), false);
  await assert.rejects(() => chat.supportCustomerContext(client, id), status(403));
  await assert.rejects(() => chat.supportStatistics(client), status(403));
  await assert.rejects(() => chat.updateSupportOperations(client, id, { note: 'Nu este permis' }), status(403));
  await chat.joinSupportThread(admin, id);
  await chat.setSupportTyping(admin, id, {});
  assert.equal((await chat.readSupportThread(client, id)).operatorOnline, true);
  assert.equal((await chat.readSupportThread(client, id)).typing, false);
  await chat.setSupportTyping(admin, id, { typing: true });
  assert.equal((await chat.readSupportThread(client, id)).typing, true);
  await chat.setSupportTyping(admin, id, { typing: false });
  assert.equal((await chat.readSupportThread(client, id)).typing, false);
  await chat.setSupportTyping(client, id, { typing: true });
  assert.equal((await chat.readSupportThread(admin, id)).typing, true);
  await chat.updateSupportOperations(admin, id, { priority: 'urgent', workflow: 'waiting', note: 'Notă privată QA' });
  const context = await chat.supportCustomerContext(admin, id);
  assert.equal(context.operations?.priority, 'urgent');
  assert.equal(context.operations?.workflow, 'waiting');
  assert.equal(context.notes[0].body, 'Notă privată QA');
  assert.doesNotMatch(JSON.stringify(await chat.readSupportThread(client, id)), /Notă privată QA/);
  await assert.rejects(() => chat.updateSupportOperations(assistant, id, { priority: 'high' }), status(403));
  await chat.assignSupportThread(admin, id, { assigneeId: assistant });
  assert.equal((await chat.readSupportThread(client, id)).operatorOnline, false);
  await assert.rejects(() => chat.sendSupportMessage(admin, { conversationId: id, message: 'Transferată' }), status(409));
  await chat.sendSupportMessage(assistant, { conversationId: id, message: 'Cazul a fost verificat.' });
  await assert.rejects(() => chat.rateSupportThread(client, id, { rating: 5 }), status(409));
  await chat.changeSupportThread(assistant, id, { action: 'complete' });
  await assert.rejects(() => chat.rateSupportThread(outsider, id, { rating: 1 }), status(404));
  await chat.rateSupportThread(client, id, { rating: 5 });
  const stats = await chat.supportStatistics(admin);
  assert.equal(stats.ratings, 1);
  assert.equal(stats.satisfaction, 5);
  assert.ok(stats.activity.some(operator => operator.name === 'Mihai Suport'));
  assert.equal((await chat.readSupportThread(client, id)).rating, 5);
});

test('Support AI requires staff for drafts and sends only the explicitly submitted brief', async t => {
  await assert.rejects(() => chat.draftSupportReply(customer, { brief: 'Unde sunt setările?' }), status(403));
  process.env.OPENAI_API_KEY = 'test-only';
  process.env.AUTOCARE_AI_MODEL = 'test-model';
  const provider = t.mock.method(globalThis, 'fetch', async (_url: string, request: RequestInit) => {
    const payload = JSON.parse(String(request.body));
    assert.equal(payload.store, false);
    assert.equal(JSON.parse(payload.input).brief, 'Unde sunt setările?');
    assert.doesNotMatch(payload.input, /Notă privată QA|@example.invalid/);
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Deschide Cont, apoi Setări.' }] }] });
  });
  try {
    assert.equal((await chat.draftSupportReply(admin, { brief: 'Unde sunt setările?' })).answer, 'Deschide Cont, apoi Setări.');
    assert.equal((await chat.draftSupportReply(customer, { brief: 'Unde sunt setările?' }, true)).answer, 'Deschide Cont, apoi Setări.');
    assert.equal(provider.mock.callCount(), 2);
  } finally {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AUTOCARE_AI_MODEL;
  }
});


test('Support premium: latest-message previews, customer vehicles and daily statistics use real scoped data', async () => {
 const client=crypto.randomUUID(),outsider=crypto.randomUUID();
 await db().insert(s.user).values([{id:client,name:'Premium Support Customer',email:client+'@example.invalid'},{id:outsider,name:'Private other customer',email:outsider+'@example.invalid'}]);
 await db().insert(s.vehicles).values([{id:crypto.randomUUID(),userId:client,brand:'Owned',model:'Vehicle',plate:'OWN-PLATE',year:2022,fuel:'Diesel',odometer:12345},{id:crypto.randomUUID(),userId:outsider,brand:'Private',model:'Other',plate:'FOREIGN-PLATE',year:2021,fuel:'Diesel'}]);
 const first=await chat.sendSupportMessage(client,{message:'Original subject'});
 await chat.sendSupportMessage(client,{conversationId:first.threadId,message:'Actual latest message preview'});
 const list=await chat.listSupportThreads(admin,'open','Premium Support Customer');
 assert.equal(list.selfId,admin);assert.equal(list.threads.length,1);
 assert.equal(list.threads[0].lastMessage?.body,'Actual latest message preview');
 assert.equal(list.threads[0].lastMessage?.authorId,client);
 await chat.joinSupportThread(admin,first.threadId);
 const afterSystem=await chat.listSupportThreads(admin,'open','Premium Support Customer');
 assert.equal(afterSystem.threads[0].lastMessage?.id,list.threads[0].lastMessage?.id);
 const context=await chat.supportCustomerContext(admin,first.threadId);
 assert.equal(context.vehicleCount,1);assert.equal(context.vehicles[0].plate,'OWN-PLATE');
 assert.doesNotMatch(JSON.stringify(context),/FOREIGN-PLATE/);
 await assert.rejects(()=>chat.supportCustomerContext(outsider,first.threadId),status(404));
 const stats=await chat.supportStatistics(admin);
 assert.equal(stats.trend.length,14);assert.ok(stats.trend.every((row,i,rows)=>/^\d{4}-\d{2}-\d{2}$/.test(row.day)&&row.count>=0&&(!i||row.day>rows[i-1].day)));
 const [expected]=await db().select({count:sql<number>`count(*)::int`}).from(s.supportThreads).where(sql`(${s.supportThreads.createdAt} AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date - 13`);
 assert.equal(stats.trend.reduce((sum,row)=>sum+row.count,0),expected.count);
 const [fresh]=await db().select({count:sql<number>`count(*)::int`}).from(s.supportThreads).where(sql`${s.supportThreads.status}='open' and ${s.supportThreads.assignedTo} is null`);
 assert.equal(stats.fresh,fresh.count);
 await chat.changeSupportThread(admin,first.threadId,{action:'complete'});
 const completed=await chat.supportStatistics(admin);
 await chat.changeSupportThread(admin,first.threadId,{action:'reopen'});
 assert.equal((await chat.supportStatistics(admin)).resolved,completed.resolved-1);
});

test('Support: owner and admin can delete active conversations without losing history', async () => {
  const owner = crypto.randomUUID();
  await db().insert(s.user).values({id: owner,name: 'Delete fixture',email: owner+'@example.invalid',emailVerified:true});
  const id = (await chat.sendSupportMessage(owner, { message: 'Poți închide această solicitare' })).threadId;
  await chat.joinSupportThread(assistant, id);
  await assert.rejects(() => chat.changeSupportThread(customer, id, { action: 'trash' }), status(404));
  await chat.changeSupportThread(owner, id, { action: 'trash' });
  const deleted = await chat.readSupportThread(owner, id);
  assert.equal(deleted.thread.status, 'trashed');
  assert.ok(deleted.thread.completedAt);
  assert.ok(deleted.messages.some(m => m.body === 'Poți închide această solicitare'));
  await assert.rejects(() => chat.sendSupportMessage(owner, { conversationId: id, message: 'Nu trimite' }), status(409));
  await chat.changeSupportThread(owner, id, { action: 'restore' });
  await chat.changeSupportThread(admin, id, { action: 'reopen' });
  await chat.changeSupportThread(admin, id, { action: 'complete' });
  await chat.changeSupportThread(admin, id, { action: 'reopen' });
  await chat.changeSupportThread(admin, id, { action: 'trash' });
  assert.equal((await chat.readSupportThread(owner, id)).thread.status, 'trashed');
});

test('Support: presence and bilingual welcome are scoped to the actual team and message retries are idempotent', async () => {
  const { supportAvailability, updateSupportPresence, supportAvailabilitySettings, resolveSupportState } = await import('../src/lib/support-availability');
  assert.equal(resolveSupportState({mode:'auto', hours:{days:[1],start:'09:00',end:'17:00'}, operators:[false]}, new Date('2026-11-23T06:00:00Z')), 'after_hours');
  assert.equal(resolveSupportState({mode:'auto', hours:null, operators:[]}), 'offline');
  await assert.rejects(() => updateSupportPresence(customer, {busy:false}), status(403));
  await assert.rejects(() => supportAvailabilitySettings(other), status(403));
  await updateSupportPresence(founder, {busy:true});
  assert.equal((await supportAvailability()).state, 'busy');
  await updateSupportPresence(founder, {busy:false});
  assert.equal((await supportAvailability()).state, 'available');
  await updateSupportPresence(founder, {busy:true});
  const id=crypto.randomUUID();
  await db().insert(s.user).values({id, name:'Customer QA', email:id+'@example.invalid', emailVerified:true});
  const payload={ message:'Test request with idempotency', clientId:crypto.randomUUID(), language:'en', category:'documents', platform:'android' };
  const [first, second] = await Promise.all([chat.sendSupportMessage(id,payload), chat.sendSupportMessage(id,payload)]);
  assert.equal(first.threadId,second.threadId);
  assert.equal([first,second].filter(result=>'duplicate' in result).length,1);
  const detail=await chat.readSupportThread(id, first.threadId);
  assert.equal(detail.messages.length,2);
  assert.match(detail.messages[0].body, /assisting other customers/);
  assert.equal((await chat.listSupportThreads(id)).threads[0].category,'documents');
  assert.equal((await chat.listSupportThreads(id)).threads[0].platform,'android');
  const followup=await chat.sendSupportMessage(id, {message:'Separate ticket intent',clientId:crypto.randomUUID(),newConversation:true});
  assert.notEqual(followup.threadId,first.threadId);
  assert.equal((await chat.listSupportThreads(id)).threads.length,2);
  const outsider=crypto.randomUUID();
  await db().insert(s.user).values({id:outsider, name:'Separate QA account', email:outsider+'@example.invalid', emailVerified:true});
  await assert.rejects(() => chat.sendSupportMessage(outsider, payload), status(409));
  await assert.rejects(() => chat.markSupportRead(outsider, first.threadId, {messageId:first.message.id}), status(404));
});
