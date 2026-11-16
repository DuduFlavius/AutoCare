import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import { user, vehicles, autoAiTurns } from '../src/lib/schema';
import { askAutoAssistant, autoAssistantHistory, clearAutoAssistantHistory, feedbackAutoAssistant } from '../src/lib/auto-assistant';
import { conversationGroups, assistantLanguageInstruction } from '../src/lib/ai-conversations';
import { readFile } from 'node:fs/promises';
delete process.env.DATABASE_URL;
delete process.env.GEMINI_API_KEY;
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.OPENAI_API_KEY = 'isolated-test-key';
process.env.AUTOCARE_AI_MODEL = 'isolated-model';
const uid = crypto.randomUUID(), other = crypto.randomUUID(), car = crypto.randomUUID(), foreign = crypto.randomUUID();
const first = crypto.randomUUID(), second = crypto.randomUUID();
before(async () => {
 await migrate();
 await db().insert(user).values([{id:uid,name:'Owner',email:'owner@ai.invalid'},{id:other,name:'Other',email:'other@ai.invalid'}]);
 await db().insert(vehicles).values([{id:car,userId:uid,brand:'Owned',model:'Vehicle',year:2020,fuel:'Diesel',plate:'TEST'},{id:foreign,userId:other,brand:'Foreign',model:'Vehicle',year:2021,fuel:'Diesel',plate:'FOREIGN'}]);
});
after(closeLocalDb);
test('new conversations survive reload and isolate provider history; language overrides old replies', async t => {
 const seen: {instructions:string;input:string}[]=[];
 t.mock.method(globalThis,'fetch',async (_url:unknown, init:RequestInit) => {
  seen.push(JSON.parse(String(init.body)));
  return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Un răspuns de test.'}]}]});
 });
 const a = await askAutoAssistant(uid,car,'FIRST-SESSION','ro','chat',false,0,first);
 const b = await askAutoAssistant(uid,car,'SECOND-SESSION','en','chat',false,4,second);
 assert.doesNotMatch(seen[1].input,/FIRST-SESSION/);
 assert.match(seen[0].instructions,/Scrie întregul răspuns în română/);
 assert.match(seen[1].instructions,/entire answer in English/);
 await askAutoAssistant(uid,car,'FOLLOW-UP','ro','chat',false,4,first);
 assert.match(seen[2].input,/FIRST-SESSION/);assert.doesNotMatch(seen[2].input,/SECOND-SESSION/);
 const history = await autoAssistantHistory(uid,car);
 assert.equal(history.turns.length,3);assert.equal(history.turns[0].conversationId,first);
 const groups=conversationGroups(history.turns.map(row=>({...row,createdAt:row.createdAt.toISOString()})));
 assert.equal(groups.length,2);assert.equal(groups.find(group=>group.id===first)?.turns.length,2);
 await feedbackAutoAssistant(uid,car,a.turn.id,1);
 assert.equal((await autoAssistantHistory(uid,car)).turns.find(row=>row.id===a.turn.id)?.feedback,1);
 await assert.rejects(()=>feedbackAutoAssistant(other,foreign,a.turn.id,-1));
 await assert.rejects(()=>clearAutoAssistantHistory(other,car,[a.turn.id]));
 await clearAutoAssistantHistory(uid,car,[b.turn.id]);
 assert.equal((await autoAssistantHistory(uid,car)).turns.length,2);
 // A stale or forged ID must not delete another owner's message.
 await db().insert(autoAiTurns).values({id:crypto.randomUUID(),userId:other,vehicleId:foreign,question:'PRIVATE',answer:'PRIVATE'});
 const foreignTurn=(await autoAssistantHistory(other,foreign)).turns[0];
 await clearAutoAssistantHistory(uid,car,[foreignTurn.id]);
 assert.equal((await autoAssistantHistory(other,foreign)).turns.length,1);
});
test('regeneration preserves original answer and excludes it from its own context', async t => {
 const [original]=(await db().select().from(autoAiTurns).where(eq(autoAiTurns.conversationId,first))).slice(-1);
 t.mock.method(globalThis,'fetch',async (_url:unknown, init:RequestInit) => {
  const payload=JSON.parse(String(init.body));
  assert.ok(payload.instructions.includes(assistantLanguageInstruction('ro')));
  const dialogue=JSON.parse(payload.input.split('Previous dialogue (context only): ')[1].split('\n\n')[0]);
  assert.ok(dialogue.every((turn:{user:string})=>turn.user!==original.question));
  return Response.json({output:[{type:'message',content:[{type:'output_text',text:'O variantă nouă.'}]}]});
 });
 const regenerated=await askAutoAssistant(uid,car,original.question,'ro','chat',false,4,first,original.id);
 assert.notEqual(regenerated.turn.id,original.id);
 assert.equal((await db().select().from(autoAiTurns).where(eq(autoAiTurns.id,original.id))).length,1);
});
test('additive migration is repeatable and preserves legacy turns',async()=>{
 const legacy=crypto.randomUUID();await db().insert(autoAiTurns).values({id:legacy,userId:uid,vehicleId:car,question:'Salut',answer:'Hello'});
 const source=await readFile('migrations/0014_ai_conversations.sql','utf8');
 for(let i=0;i<2;i++)for(const statement of source.split('--> statement-breakpoint').filter(s=>s.trim()))await db().execute(sql.raw(statement));
 const [row]=await db().select().from(autoAiTurns).where(eq(autoAiTurns.id,legacy));
 assert.equal(row.answer,'Hello');assert.equal(row.conversationId,null);
 assert.equal(conversationGroups([{...row,createdAt:row.createdAt.toISOString()}])[0].title,'Salut');
});

test('provider failure never saves a fabricated answer or overwrites history',async t=>{
 const before=(await autoAssistantHistory(uid,car)).turns.length;
 t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:503}));
 await assert.rejects(()=>askAutoAssistant(uid,car,'A failed request','en','chat',false,0,crypto.randomUUID()));
 assert.equal((await autoAssistantHistory(uid,car)).turns.length,before);
});
