import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import { user, vehicles, autoAiTurns, feedbackItems } from '../src/lib/schema';
import { askAutoAssistant, autoAssistantHistory, clearAutoAssistantHistory, feedbackAutoAssistant, reportAutoAssistant, renameAiConversation } from '../src/lib/auto-assistant';
import { AI_HISTORY_LIMIT, conversationGroups, conversationSections, assistantLanguageInstruction } from '../src/lib/ai-conversations';
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

test('provider deltas arrive before completion and retries persist one turn', async t => {
 const encoder=new TextEncoder();
 let finish!:()=>void, started!:()=>void, calls=0;
 const firstDelta=new Promise<void>(resolve=>{started=resolve;});
 t.mock.method(globalThis,'fetch',async (_url:unknown,init:RequestInit)=>{
  calls++;
  assert.equal(JSON.parse(String(init.body)).stream,true);
  return new Response(new ReadableStream<Uint8Array>({start(output){
   const firstFrame=encoder.encode('data: {"type":"response.output_text.delta","delta":"Mulțumesc"}\r\n\r\n');
   const split=firstFrame.indexOf(0xc8)+1;
   output.enqueue(firstFrame.slice(0,split));output.enqueue(firstFrame.slice(split));
   finish=()=>{output.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"! Drumuri bune."}\n\ndata: {"type":"response.completed"}\n\n'));output.close();};
  }}));
 });
 const conversationId=crypto.randomUUID(),requestId=crypto.randomUUID(),signal=new AbortController().signal;
 const chunks:string[]=[];
 const stream={signal,requestId,delta:(value:string)=>{chunks.push(value);started();},beforeGenerate:async()=>{}};
 const call=()=>askAutoAssistant(uid,car,'Mersi','ro','chat',false,0,conversationId,undefined,[],stream);
 const result=call();
 await firstDelta;
 assert.deepEqual(chunks,['Mulțumesc']);
 assert.ok(!(await autoAssistantHistory(uid,car)).turns.some(turn=>turn.id===requestId));
 finish();
 assert.equal((await result).turn.answer,'Mulțumesc! Drumuri bune.');
 assert.equal((await call()).turn.id,requestId);
 assert.equal(calls,1);
 assert.equal((await autoAssistantHistory(uid,car)).turns.filter(turn=>turn.id===requestId).length,1);
});

test('an interrupted Gemini stream drops provider reasoning and never saves a partial answer', async t=>{
 const previousKey=process.env.GEMINI_API_KEY;
 process.env.GEMINI_API_KEY='isolated-gemini-key';
 try{
  t.mock.method(globalThis,'fetch',async (url:unknown)=>{
   assert.match(String(url),/streamGenerateContent\?alt=sse$/);
   return new Response('data: {"candidates":[{"content":{"parts":[{"text":"Hidden","thought":true},{"text":"Parțial"}]}}]}\n\n');
  });
  const requestId=crypto.randomUUID(),chunks:string[]=[];
  await assert.rejects(()=>askAutoAssistant(uid,car,'Cum funcționează?','ro','chat',false,0,first,undefined,[],{requestId,signal:new AbortController().signal,delta:text=>chunks.push(text),beforeGenerate:async()=>{}}));
  assert.deepEqual(chunks,['Parțial']);
  assert.ok(!(await autoAssistantHistory(uid,car)).turns.some(turn=>turn.id===requestId));
 }finally{
  if(previousKey===undefined)delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY=previousKey;
 }
});


test('conversation titles survive reload and are scoped to the owner and vehicle',async()=>{
 const conversationId=crypto.randomUUID(), id=crypto.randomUUID();
 await db().insert(autoAiTurns).values({id,userId:uid,vehicleId:car,question:'Prima întrebare',answer:'Text',conversationId});
 await assert.rejects(()=>renameAiConversation(other,car,conversationId,'Alt cont'));
 await assert.rejects(()=>renameAiConversation(other,foreign,conversationId,'Alt vehicul'));
 await renameAiConversation(uid,car,conversationId,'Revizie și documente');
 assert.equal((await autoAssistantHistory(uid,car)).titles[conversationId],'Revizie și documente');
 await clearAutoAssistantHistory(uid,car,[id]);
 assert.equal((await autoAssistantHistory(uid,car)).titles[conversationId],undefined);
});

test('deleting one conversation removes its entire retained history and title for its owner only', async () => {
 const conversationId = crypto.randomUUID();
 const secondVehicle = crypto.randomUUID();
 await db().insert(vehicles).values({id:secondVehicle,userId:uid,brand:'Owned',model:'Second',year:2020,fuel:'Diesel',plate:'TEST2'});
 const base = new Date('2025-08-09T00:01:00Z');
 await db().insert(autoAiTurns).values([
  ...Array.from({length:AI_HISTORY_LIMIT - 1}, (_, index) => ({
   id:crypto.randomUUID(),userId:uid,vehicleId:secondVehicle,conversationId,
   question:'History ' + index,answer:'Answer',createdAt:new Date(+base + index * 1000),
  })),
  {id:crypto.randomUUID(),userId:uid,vehicleId:secondVehicle,question:'Old import',answer:'Legacy answer',createdAt:base},
  {id:crypto.randomUUID(),userId:other,vehicleId:foreign,conversationId,question:'Private history',answer:'Private answer'},
 ]);
 await renameAiConversation(uid,secondVehicle,conversationId,'Long conversation');
 await renameAiConversation(uid,secondVehicle,'legacy:2025-08-09','Legacy title');
 await renameAiConversation(other,foreign,conversationId,'Private title');
 assert.equal((await autoAssistantHistory(uid,secondVehicle)).turns.length,AI_HISTORY_LIMIT);
 await assert.rejects(()=>clearAutoAssistantHistory(other,secondVehicle,conversationId));
 await assert.rejects(()=>clearAutoAssistantHistory(uid,foreign,conversationId));
 await clearAutoAssistantHistory(uid,secondVehicle,conversationId);
 await clearAutoAssistantHistory(uid,secondVehicle,conversationId);
 const afterDelete = await autoAssistantHistory(uid,secondVehicle);
 assert.deepEqual(afterDelete.turns.map(turn=>turn.question),['Old import']);
 assert.deepEqual(afterDelete.titles,{'legacy:2025-08-09':'Legacy title'});
 assert.equal((await autoAssistantHistory(other,foreign)).titles[conversationId],'Private title');
 await clearAutoAssistantHistory(uid,secondVehicle,'legacy:2025-08-09');
 assert.deepEqual(await autoAssistantHistory(uid,secondVehicle),{turns:[],titles:{}});
});

test('a continued conversation deleted while a reply is generating stays deleted', async t => {
 const conversationId = crypto.randomUUID();
 const previousId = crypto.randomUUID();
 await db().insert(autoAiTurns).values({id:previousId,userId:uid,vehicleId:car,conversationId,question:'Previous',answer:'Answer'});
 t.mock.method(globalThis,'fetch',async () => {
  await clearAutoAssistantHistory(uid,car,conversationId);
  return Response.json({output:[{type:'message',content:[{type:'output_text',text:'A late reply'}]}]});
 });
 const followup = () => askAutoAssistant(uid,car,'Follow up','en','chat',false,1,conversationId,undefined,[previousId]);
 await assert.rejects(followup,/Conversația nu mai este disponibilă/);
 await assert.rejects(followup,/Conversația nu mai este disponibilă/);
 assert.ok(!(await autoAssistantHistory(uid,car)).turns.some(turn=>turn.conversationId===conversationId));
});

test('history sections use local calendar boundaries and the last seven days include today', () => {
 const date = (day: number) => new Date(2026,10,day,0,5).toISOString();
 const grouped = conversationGroups([18,19,23,24,25].map(day=>({id:String(day),question:String(day),answer:'',createdAt:date(day)})));
 assert.deepEqual(
  conversationSections(grouped, new Date(2026,10,25,23,59)).map(section=>[section.key,section.groups.map(group=>group.title)]),
  [['today',['25']],['yesterday',['24']],['week',['23','19']],['older',['18']]],
 );
});

test('AI reports share only the selected output, require ownership and are idempotent', async () => {
 const id=crypto.randomUUID();
 await db().insert(autoAiTurns).values({id,userId:uid,vehicleId:car,question:'PRIVATE QUESTION',answer:'Selected answer for review.'});
 await assert.rejects(()=>reportAutoAssistant(other,car,id));
 await assert.rejects(()=>reportAutoAssistant(other,foreign,id));
 const first=await reportAutoAssistant(uid,car,id);
 const next=await reportAutoAssistant(uid,car,id);
 assert.equal(first.id,next.id);
 assert.equal(next.duplicate,true);
 const [item]=await db().select().from(feedbackItems).where(eq(feedbackItems.id,first.id));
 assert.equal(item.userId,uid);
 assert.equal(item.area,'ai');
 assert.match(item.message,/Selected answer for review/);
 assert.doesNotMatch(item.message,/PRIVATE QUESTION/);
});
