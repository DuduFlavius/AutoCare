import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {eq} from 'drizzle-orm';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import * as feedback from '../src/lib/feedback';
import {feedbackCopy} from '../src/lib/feedback-copy';
process.env.LOCAL_DATABASE_PATH='memory';
const uid=crypto.randomUUID(),other=crypto.randomUUID(),admin=crypto.randomUUID(),assistant=crypto.randomUUID(),founder=crypto.randomUUID();
process.env.AUTOCARE_FOUNDER_USER_ID=founder;
const status=(code:number)=>(error:unknown)=>!!error&&typeof error==='object'&&'status' in error&&error.status===code;
const input=(message='O sugestie clară pentru aplicația AutoCare.')=>({clientId:crypto.randomUUID(),category:'suggestion',area:'general',rating:4,message});
let id:string,fileId:string;
before(async()=>{await migrate();for(const [id,role] of [[uid,'user'],[other,'user'],[admin,'admin'],[assistant,'assistant'],[founder,'founder']]){await db().insert(s.user).values({id,name:'Test '+role,email:id+'@example.invalid',emailVerified:true,createdAt:new Date(Date.now()-10*86400000)});await db().insert(s.profiles).values({userId:id,role,pushEnabled:false});}});
after(closeLocalDb);
test('Feedback is free, atomic with screenshots, private and idempotent under retries',async()=>{
 const image=await sharp({create:{width:20,height:20,channels:3,background:'#7859aa'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'PRIVATE-HIDDEN-METADATA'}}}).toBuffer();
 const value=input();const results=await Promise.all([feedback.createFeedback(uid,value,[{bytes:image}]),feedback.createFeedback(uid,value,[{bytes:image}])]);id=results[0].id;
 assert.equal(results[1].id,id);assert.equal((await feedback.listFeedback(uid)).total,1);
 const detail=await feedback.readFeedback(uid,id);assert.equal(detail.item.status,'new');assert.equal(detail.files.length,1);assert.equal(detail.events.length,1);fileId=detail.files[0].id;
 assert.equal((await feedback.listFeedback(other)).total,0);await assert.rejects(()=>feedback.readFeedback(other,id),status(404));await assert.rejects(()=>feedback.feedbackFile(other,fileId),status(404));
 const stored=await feedback.feedbackFile(uid,fileId);assert.equal(stored.mime,'image/png');assert.equal((await sharp(Buffer.from(stored.data,'base64')).metadata()).exif,undefined);
 assert.ok(!Buffer.from(stored.data,'base64').includes(Buffer.from('PRIVATE-HIDDEN-METADATA')));assert.equal((await feedback.feedbackFile(admin,fileId)).id,fileId);
 assert.equal((await feedback.feedbackNotices(admin)).count,1);assert.equal((await feedback.feedbackNotices(assistant)).count,0);
 assert.equal((await feedback.listFeedback(admin,new URLSearchParams('scope=admin'))).total,1);
 assert.equal((await feedback.listFeedback(admin)).total,0);
});
test('Feedback rejects privilege injection, invalid ratings, oversized or executable files, duplicates and bursts',async()=>{
 await assert.rejects(()=>feedback.createFeedback(other,{...input(),status:'resolved',userId:uid}));
 await assert.rejects(()=>feedback.createFeedback(other,{...input(),rating:6}));await assert.rejects(()=>feedback.createFeedback(other,{...input(),message:' '}));
 for(const bytes of [Buffer.from('<svg onload="alert(1)"></svg>'),Buffer.from('%PDF-1.7'),Buffer.from('fake-image')])await assert.rejects(()=>feedback.createFeedback(other,input(),[{bytes}]),status(400));
 await assert.rejects(()=>feedback.createFeedback(other,input(),[{bytes:Buffer.alloc(2097153)}]),status(413));
 await assert.rejects(()=>feedback.createFeedback(other,input(),Array(3).fill({bytes:Buffer.from('bad')})),status(400));
 assert.equal((await feedback.listFeedback(other)).total,0);
 await assert.rejects(()=>feedback.createFeedback(uid,input()),status(409));await assert.rejects(()=>feedback.createFeedback(uid,input('Un alt mesaj trimis mult prea repede.')),status(429));
 for(let i=0;i<4;i++)await db().insert(s.feedbackItems).values({id:crypto.randomUUID(),userId:other,...input('Mesaj anterior '+i+' pentru limitare.'),fingerprint:'old'+i,createdAt:new Date(Date.now()-(i+1)*120000)});
 await feedback.createFeedback(other,input('A cincea solicitare distinctă din zi.'));await db().update(s.feedbackItems).set({createdAt:new Date(Date.now()-120000)}).where(eq(s.feedbackItems.userId,other));
 await assert.rejects(()=>feedback.createFeedback(other,input('A șasea solicitare distinctă din zi.')),status(429));
});
test('Only administrators can manage feedback; updates use revision locks and preserve history',async()=>{
 await assert.rejects(()=>feedback.listFeedback(uid,new URLSearchParams('scope=admin')),status(403));await assert.rejects(()=>feedback.listFeedback(assistant,new URLSearchParams('scope=admin')),status(403));
 await assert.rejects(()=>feedback.feedbackStatistics(uid),status(403));await assert.rejects(()=>feedback.updateFeedback(uid,id,{status:'resolved',priority:'critical',revision:1}),status(403));
 const out=await feedback.updateFeedback(admin,id,{status:'progress',priority:'critical',revision:1});assert.equal(out.noticeIds.length,1);
 await assert.rejects(()=>feedback.updateFeedback(admin,id,{status:'closed',priority:'normal',revision:1}),status(409));
 const detail=await feedback.readFeedback(uid,id);assert.equal(detail.item.revision,2);assert.equal(detail.item.status,'progress');assert.equal(detail.events.length,2);
 assert.equal((await feedback.feedbackNotices(uid)).count,1);await feedback.markFeedbackRead(uid,id);assert.equal((await feedback.feedbackNotices(uid)).count,0);
 const same=await feedback.updateFeedback(admin,id,{status:'progress',priority:'critical',revision:2});assert.equal(same.noticeIds.length,0);
});
test('Replies notify the owner, do not leak content into pushes, and deduplicate retries',async()=>{
 const value={clientId:crypto.randomUUID(),message:'Răspuns privat care nu trebuie pus în notificare.'};
 const first=await feedback.replyFeedback(admin,id,value);await feedback.replyFeedback(admin,id,value);
 const detail=await feedback.readFeedback(uid,id);assert.equal(detail.replies.length,1);assert.equal(detail.replies[0].authorRole,'admin');assert.equal(detail.events.filter(row=>row.action==='reply').length,1);
 await db().update(s.profiles).set({pushEnabled:true}).where(eq(s.profiles.userId,uid));
 const sent:unknown[]=[];const transport=async(userId:string,payload:unknown)=>{assert.equal(userId,uid);sent.push(payload);};
 await Promise.all([feedback.deliverFeedbackNotices(first.noticeIds,transport),feedback.deliverFeedbackNotices(first.noticeIds,transport)]);
 assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes('Răspuns privat'));assert.ok(!JSON.stringify(sent).includes('@'));
 await assert.rejects(()=>feedback.replyFeedback(other,id,{clientId:crypto.randomUUID(),message:'Nu am voie'}),status(404));
 await assert.rejects(()=>feedback.replyFeedback(uid,id,{clientId:crypto.randomUUID(),message:'OK',authorRole:'admin'}));
 const answer=await feedback.replyFeedback(uid,id,{clientId:crypto.randomUUID(),message:'Mulțumesc pentru răspuns.'});await feedback.deliverFeedbackNotices(answer.noticeIds,async()=>{throw Error('provider');});
 assert.equal((await feedback.readFeedback(uid,id)).replies[1].authorRole,'user');
});
test('Administrator filters, stats, critical priority and closed threads match saved data',async()=>{
 const filtered=await feedback.listFeedback(admin,new URLSearchParams('scope=admin&category=suggestion&status=progress&priority=critical&rating=4&from='+new Date().toISOString().slice(0,10)));
 assert.equal(filtered.rows.length,1);assert.equal(filtered.rows[0].id,id);
 const stats=await feedback.feedbackStatistics(founder);assert.equal(stats.total,6);assert.equal(stats.average,4);assert.equal(stats.critical,1);assert.equal(stats.rated,6);
 await assert.rejects(()=>feedback.listFeedback(admin,new URLSearchParams('scope=admin&rating=9')));
 const detail=await feedback.readFeedback(admin,id);await feedback.updateFeedback(admin,id,{status:'closed',priority:'normal',revision:detail.item.revision});
 await assert.rejects(()=>feedback.replyFeedback(uid,id,{clientId:crypto.randomUUID(),message:'Nu mai este deschis.'}),status(409));
});
test('Invitations require real usage, are claimed once, and dismissal/submission is permanent',async()=>{
 assert.equal((await feedback.feedbackInvitation(uid)).eligible,false);
 const invited=crypto.randomUUID();await db().insert(s.user).values({id:invited,name:'Used app',email:invited+'@example.invalid',createdAt:new Date(Date.now()-10*86400000)});await db().insert(s.profiles).values({userId:invited});
 const car=crypto.randomUUID();await db().insert(s.vehicles).values({id:car,userId:invited,brand:'Test',model:'One',year:2020,plate:'TEST',fuel:'Electric'});
 for(let i=0;i<3;i++)await db().insert(s.records).values({id:crypto.randomUUID(),userId:invited,vehicleId:car,kind:'expense',category:'Parcare',title:'Usage',date:'2026-01-01'});
 assert.equal((await feedback.feedbackInvitation(invited)).eligible,true);
 const claims=await Promise.all([feedback.feedbackInvitation(invited,'shown'),feedback.feedbackInvitation(invited,'shown')]);assert.equal(claims.filter(row=>row.eligible).length,1);
 await feedback.feedbackInvitation(invited,'dismiss');assert.equal((await feedback.feedbackInvitation(invited)).eligible,false);
});
test('Founder can read feedback authors for follow-up; ordinary users never receive author contact details',async()=>{
 const own=await feedback.readFeedback(uid,id);assert.equal('owner' in own,false);
 const asFounder=await feedback.readFeedback(founder,id);assert.deepEqual(asFounder.owner,{name:'Test user',email:uid+'@example.invalid'});
 const asAdmin=await feedback.readFeedback(admin,id);assert.equal(asAdmin.owner?.email,uid+'@example.invalid');
 await assert.rejects(()=>feedback.readFeedback(other,id),status(404));
 const impostor=crypto.randomUUID();await db().insert(s.user).values({id:impostor,name:'Not owner',email:impostor+'@example.invalid',emailVerified:true});await db().insert(s.profiles).values({userId:impostor,role:'founder'});
 await assert.rejects(()=>feedback.listFeedback(impostor,new URLSearchParams('scope=admin')),status(403));
});

test('Feedback translations cover every stored enum and account deletion cascades private data',async()=>{
 for(const [values,group] of [[feedback.feedbackCategories,copy('category')],[feedback.feedbackStatuses,copy('status')],[feedback.feedbackPriorities,copy('priority')],[feedback.feedbackAreas,copy('area')]] as const)for(const value of values)assert.equal(group[value as keyof typeof group]?.length,2);
 await db().delete(s.user).where(eq(s.user.id,uid));assert.equal((await db().select().from(s.feedbackFiles).where(eq(s.feedbackFiles.id,fileId))).length,0);assert.equal((await db().select().from(s.feedbackItems).where(eq(s.feedbackItems.id,id))).length,0);
 assert.equal((await db().select().from(s.feedbackNotices).where(eq(s.feedbackNotices.feedbackId,id))).length,0);
});
function copy(group:keyof Omit<typeof feedbackCopy,'error'>){return feedbackCopy[group] as Record<string,readonly[string,string]>;}

test('Simple short opinions are accepted for free users without issue-report fields',async()=>{
 const reviewer=crypto.randomUUID();await db().insert(s.user).values({id:reviewer,name:'Reviewer',email:reviewer+'@example.invalid',emailVerified:true});
 const result=await feedback.createFeedback(reviewer,{clientId:crypto.randomUUID(),category:'experience',message:'E fain',rating:5});
 const saved=await feedback.readFeedback(reviewer,result.id);assert.equal(saved.item.message,'E fain');assert.equal(saved.item.category,'experience');assert.equal(saved.files.length,0);
});
