import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { and, eq, desc, sql, gte, lte, isNull, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import * as s from './schema';
import { AppError, assertActiveAccount, profile } from './service';
import { founderId } from './permissions';
export const feedbackCategories=['suggestion','problem','experience'] as const;
export const feedbackStatuses=['new','review','progress','resolved','closed'] as const;
export const feedbackPriorities=['normal','high','critical'] as const;
export const feedbackAreas=['general','documents','gps','expenses','account','support','ai'] as const;
export const feedbackInput=z.object({clientId:z.string().uuid(),category:z.enum(feedbackCategories),area:z.enum(feedbackAreas).default('general'),rating:z.number().int().min(1).max(5).nullable().default(null),message:z.string().trim().min(2).max(5000)}).strict();
export function isFeedbackAdmin(role:string){return ['admin','superadmin','founder'].includes(role);}
async function actor(uid:string){await assertActiveAccount(uid);return {uid,admin:isFeedbackAdmin((await profile(uid)).role)};}
async function access(uid:string,id:string){const who=await actor(uid);const item=(await db().select().from(s.feedbackItems).where(eq(s.feedbackItems.id,z.string().uuid().parse(id))))[0];if(!item||(!who.admin&&item.userId!==uid))throw new AppError(404,'FEEDBACK_NOT_FOUND');return {who,item};}
async function administrators(){const rows=await db().select({id:s.profiles.userId,role:s.profiles.role}).from(s.profiles);const owner=founderId();return [...new Set(rows.filter(r=>isFeedbackAdmin(r.role)&&r.role!=='founder'||r.id===owner).map(r=>r.id).concat(owner?[owner]:[]))];}
export type ScreenshotUpload={bytes:Buffer};
export async function feedbackScreenshot(bytes:Buffer){
 if(!bytes.length||bytes.length>2097152)throw new AppError(413,'FEEDBACK_FILE_SIZE');
 try{
  const image=sharp(bytes,{limitInputPixels:20000000,animated:false,failOn:'warning'});
  const meta=await image.metadata();
  if(!['png','jpeg','webp'].includes(meta.format||'')||(meta.pages??1)>1)throw Error('format');
  const clean=await image.rotate().png({compressionLevel:9}).toBuffer();
  if(clean.length>2097152)throw new AppError(413,'FEEDBACK_FILE_SIZE');
  return {bytes:clean,mime:'image/png'};
 }catch(e){if(e instanceof AppError)throw e;throw new AppError(400,'FEEDBACK_FILE_TYPE');}
}
export async function createFeedback(uid:string,input:unknown,uploads:ScreenshotUpload[]=[]){
 await actor(uid);const value=feedbackInput.parse(input);
 if(uploads.length>2)throw new AppError(400,'FEEDBACK_FILE_COUNT');
 const existing=(await db().select({id:s.feedbackItems.id}).from(s.feedbackItems).where(and(eq(s.feedbackItems.userId,uid),eq(s.feedbackItems.clientId,value.clientId))))[0];
 if(existing)return {id:existing.id,noticeIds:[],duplicate:true};
 const images=await Promise.all(uploads.map(file=>feedbackScreenshot(file.bytes)));
 const fingerprint=createHash('sha256').update(JSON.stringify([value.category,value.area,value.rating,value.message.toLocaleLowerCase().replace(/\s+/g,' ')])).digest('hex');
 const recipients=(await administrators()).filter(id=>id!==uid);
 return db().transaction(async tx=>{
  await tx.select({id:s.user.id}).from(s.user).where(eq(s.user.id,uid)).for('update');
  const retry=(await tx.select({id:s.feedbackItems.id}).from(s.feedbackItems).where(and(eq(s.feedbackItems.userId,uid),eq(s.feedbackItems.clientId,value.clientId))))[0];
  if(retry)return {id:retry.id,noticeIds:[],duplicate:true};
  const recent=await tx.select().from(s.feedbackItems).where(and(eq(s.feedbackItems.userId,uid),gte(s.feedbackItems.createdAt,new Date(Date.now()-86400000))));
  if(recent.some(row=>row.fingerprint===fingerprint))throw new AppError(409,'FEEDBACK_DUPLICATE');
  if(recent.length>=5||recent.some(row=>Date.now()-row.createdAt.getTime()<60000))throw new AppError(429,'FEEDBACK_RATE_LIMIT');
  const id=randomUUID(),now=new Date();
  await tx.insert(s.feedbackItems).values({id,userId:uid,...value,fingerprint});
  if(images.length)await tx.insert(s.feedbackFiles).values(images.map((image,i)=>({id:randomUUID(),feedbackId:id,name:`screenshot-${i+1}.png`,mime:image.mime,size:image.bytes.length,data:image.bytes.toString('base64')})));
  await tx.insert(s.feedbackEvents).values({id:randomUUID(),feedbackId:id,actorId:uid,action:'created',details:{status:'new'}});
  await tx.insert(s.feedbackPreferences).values({userId:uid,submittedAt:now}).onConflictDoUpdate({target:s.feedbackPreferences.userId,set:{submittedAt:now}});
  const notices=recipients.map(userId=>({id:randomUUID(),userId,feedbackId:id,kind:'new'}));
  if(notices.length)await tx.insert(s.feedbackNotices).values(notices);
  return {id,noticeIds:notices.map(n=>n.id),duplicate:false};
 });
}
export async function listFeedback(uid:string,params=new URLSearchParams()){
 const who=await actor(uid),admin=params.get('scope')==='admin';if(admin&&!who.admin)throw new AppError(403,'FEEDBACK_ADMIN_ONLY');
 const f=z.object({category:z.enum(feedbackCategories).optional(),status:z.enum(feedbackStatuses).optional(),priority:z.enum(feedbackPriorities).optional(),rating:z.coerce.number().int().min(1).max(5).optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),page:z.coerce.number().int().min(0).max(10000).default(0),q:z.string().trim().max(120).default('')}).parse(Object.fromEntries([...params].filter(([key,value])=>key!=='scope'&&value!=='')));
 const where=and(admin?undefined:eq(s.feedbackItems.userId,uid),f.category?eq(s.feedbackItems.category,f.category):undefined,f.status?eq(s.feedbackItems.status,f.status):undefined,f.priority?eq(s.feedbackItems.priority,f.priority):undefined,f.rating?eq(s.feedbackItems.rating,f.rating):undefined,f.from?gte(s.feedbackItems.createdAt,new Date(f.from+'T00:00:00Z')):undefined,f.to?lte(s.feedbackItems.createdAt,new Date(f.to+'T23:59:59.999Z')):undefined,f.q?sql`strpos(lower(${s.feedbackItems.message}),lower(${f.q}))>0`:undefined);
 const [rows,total]=await Promise.all([db().select({item:s.feedbackItems,ownerName:s.user.name}).from(s.feedbackItems).innerJoin(s.user,eq(s.user.id,s.feedbackItems.userId)).where(where).orderBy(admin?sql`case ${s.feedbackItems.priority} when 'critical' then 0 when 'high' then 1 else 2 end`:desc(s.feedbackItems.updatedAt),desc(s.feedbackItems.updatedAt),desc(s.feedbackItems.id)).limit(20).offset(f.page*20),db().select({n:count()}).from(s.feedbackItems).where(where)]);
 return {rows:rows.map(({item,ownerName})=>({...item,fingerprint:undefined,clientId:undefined,ownerName:admin?ownerName:undefined,userId:undefined})),total:total[0].n,page:f.page,admin:who.admin};
}
export async function readFeedback(uid:string,id:string){
 const {item,who}=await access(uid,id);
 const [replies,files,events]=await Promise.all([
  db().select({id:s.feedbackReplies.id,message:s.feedbackReplies.message,authorRole:s.feedbackReplies.authorRole,createdAt:s.feedbackReplies.createdAt}).from(s.feedbackReplies).where(eq(s.feedbackReplies.feedbackId,id)).orderBy(s.feedbackReplies.createdAt,s.feedbackReplies.id),
  db().select({id:s.feedbackFiles.id,name:s.feedbackFiles.name,mime:s.feedbackFiles.mime,size:s.feedbackFiles.size}).from(s.feedbackFiles).where(eq(s.feedbackFiles.feedbackId,id)),
  db().select({id:s.feedbackEvents.id,action:s.feedbackEvents.action,details:s.feedbackEvents.details,createdAt:s.feedbackEvents.createdAt}).from(s.feedbackEvents).where(eq(s.feedbackEvents.feedbackId,id)).orderBy(s.feedbackEvents.createdAt,s.feedbackEvents.id),
 ]);
 const owner=who.admin?(await db().select({name:s.user.name,email:s.user.email}).from(s.user).where(eq(s.user.id,item.userId)))[0]:undefined;
 return {item:{...item,userId:undefined,clientId:undefined,fingerprint:undefined},replies,files,events,admin:who.admin,...(owner?{owner}:{})};
}
export async function updateFeedback(uid:string,id:string,input:unknown){
 const {who}=await access(uid,id);if(!who.admin)throw new AppError(403,'FEEDBACK_ADMIN_ONLY');
 const value=z.object({status:z.enum(feedbackStatuses),priority:z.enum(feedbackPriorities),revision:z.number().int().positive()}).strict().parse(input);
 return db().transaction(async tx=>{
  const [item]=await tx.select().from(s.feedbackItems).where(eq(s.feedbackItems.id,id)).for('update');
  if(item.revision!==value.revision)throw new AppError(409,'FEEDBACK_CHANGED');
  if(item.status===value.status&&item.priority===value.priority)return {id,noticeIds:[]};
  await tx.update(s.feedbackItems).set({status:value.status,priority:value.priority,revision:item.revision+1,updatedAt:new Date()}).where(eq(s.feedbackItems.id,id));
  await tx.insert(s.feedbackEvents).values({id:randomUUID(),feedbackId:id,actorId:uid,action:'updated',details:{fromStatus:item.status,toStatus:value.status,fromPriority:item.priority,toPriority:value.priority}});
  const noticeId=randomUUID();await tx.insert(s.feedbackNotices).values({id:noticeId,feedbackId:id,userId:item.userId,kind:'status'});
  return {id,noticeIds:[noticeId]};
 });
}
export async function replyFeedback(uid:string,id:string,input:unknown){
 const {who,item}=await access(uid,id);
 const value=z.object({message:z.string().trim().min(2).max(5000),clientId:z.string().uuid()}).strict().parse(input);
 const recipients=who.admin&&item.userId!==uid?[item.userId]:(await administrators()).filter(userId=>userId!==uid);
 return db().transaction(async tx=>{
  await tx.select({id:s.user.id}).from(s.user).where(eq(s.user.id,uid)).for('update');
  const [locked]=await tx.select().from(s.feedbackItems).where(eq(s.feedbackItems.id,id)).for('update');
  const [existing]=await tx.select({id:s.feedbackReplies.id}).from(s.feedbackReplies).where(and(eq(s.feedbackReplies.feedbackId,id),eq(s.feedbackReplies.clientId,value.clientId)));
  if(existing)return {id,noticeIds:[]};
  if(locked.status==='closed')throw new AppError(409,'FEEDBACK_CLOSED');
  const recent=await tx.select({n:count()}).from(s.feedbackReplies).where(and(eq(s.feedbackReplies.authorId,uid),gte(s.feedbackReplies.createdAt,new Date(Date.now()-86400000))));
  if(recent[0].n>=30)throw new AppError(429,'FEEDBACK_RATE_LIMIT');
  const previous=await tx.select({createdAt:s.feedbackReplies.createdAt}).from(s.feedbackReplies).where(eq(s.feedbackReplies.authorId,uid)).orderBy(desc(s.feedbackReplies.createdAt)).limit(1);
  if(previous[0]&&Date.now()-previous[0].createdAt.getTime()<5000)throw new AppError(429,'FEEDBACK_RATE_LIMIT');
  await tx.insert(s.feedbackReplies).values({id:randomUUID(),feedbackId:id,authorId:uid,authorRole:who.admin?'admin':'user',...value});
  await tx.update(s.feedbackItems).set({revision:locked.revision+1,updatedAt:new Date()}).where(eq(s.feedbackItems.id,id));
  await tx.insert(s.feedbackEvents).values({id:randomUUID(),feedbackId:id,actorId:uid,action:'reply',details:{role:who.admin?'admin':'user'}});
  const notices=recipients.map(userId=>({id:randomUUID(),feedbackId:id,userId,kind:'reply'}));if(notices.length)await tx.insert(s.feedbackNotices).values(notices);
  return {id,noticeIds:notices.map(n=>n.id)};
 });
}
export async function feedbackFile(uid:string,id:string){
 await actor(uid);const [file]=await db().select().from(s.feedbackFiles).where(eq(s.feedbackFiles.id,z.string().uuid().parse(id)));if(!file)throw new AppError(404,'FEEDBACK_NOT_FOUND');await access(uid,file.feedbackId);return file;
}
export async function feedbackNotices(uid:string){await actor(uid);const rows=await db().select({id:s.feedbackNotices.id,feedbackId:s.feedbackNotices.feedbackId,kind:s.feedbackNotices.kind,createdAt:s.feedbackNotices.createdAt}).from(s.feedbackNotices).where(and(eq(s.feedbackNotices.userId,uid),isNull(s.feedbackNotices.readAt))).orderBy(desc(s.feedbackNotices.createdAt)).limit(50);return {count:rows.length,rows};}
export async function markFeedbackRead(uid:string,id:string){await access(uid,id);await db().update(s.feedbackNotices).set({readAt:new Date()}).where(and(eq(s.feedbackNotices.feedbackId,id),eq(s.feedbackNotices.userId,uid)));return {ok:true};}
export async function feedbackStatistics(uid:string){
 const who=await actor(uid);if(!who.admin)throw new AppError(403,'FEEDBACK_ADMIN_ONLY');
 const [summary,ratings,statuses,areas]=await Promise.all([
  db().select({total:count(),average:sql<string|null>`avg(${s.feedbackItems.rating})`,rated:sql<number>`count(${s.feedbackItems.rating})::int`,critical:sql<number>`count(*) filter(where ${s.feedbackItems.priority}='critical' and ${s.feedbackItems.status} not in ('resolved','closed'))::int`}).from(s.feedbackItems),
  db().select({rating:s.feedbackItems.rating,count:count()}).from(s.feedbackItems).where(sql`${s.feedbackItems.rating} is not null`).groupBy(s.feedbackItems.rating),
  db().select({status:s.feedbackItems.status,count:count()}).from(s.feedbackItems).groupBy(s.feedbackItems.status),
  db().select({area:s.feedbackItems.area,count:count()}).from(s.feedbackItems).where(eq(s.feedbackItems.category,'problem')).groupBy(s.feedbackItems.area).orderBy(desc(count())),
 ]);return {...summary[0],average:summary[0].average===null?null:Number(summary[0].average),ratings,statuses,areas};
}
export async function feedbackInvitation(uid:string,action?:'shown'|'dismiss'){
 await actor(uid);const [user]=await db().select({createdAt:s.user.createdAt}).from(s.user).where(eq(s.user.id,uid));
 const [prefs]=await db().select().from(s.feedbackPreferences).where(eq(s.feedbackPreferences.userId,uid));
 if(action==='dismiss'){await db().insert(s.feedbackPreferences).values({userId:uid,dismissedAt:new Date()}).onConflictDoUpdate({target:s.feedbackPreferences.userId,set:{dismissedAt:new Date()}});return {eligible:false};}
 const [usage]=await db().select({n:count()}).from(s.records).where(eq(s.records.userId,uid));
 const eligible=!!user&&Date.now()-user.createdAt.getTime()>=7*86400000&&usage.n>=3&&!prefs?.dismissedAt&&!prefs?.submittedAt&&!prefs?.invitedAt;
 if(action==='shown'&&eligible){const result=await db().insert(s.feedbackPreferences).values({userId:uid,invitedAt:new Date()}).onConflictDoUpdate({target:s.feedbackPreferences.userId,set:{invitedAt:new Date()},setWhere:sql`${s.feedbackPreferences.invitedAt} is null and ${s.feedbackPreferences.dismissedAt} is null and ${s.feedbackPreferences.submittedAt} is null`}).returning();return {eligible:result.length===1};}
 return {eligible};
}
export async function deliverFeedbackNotices(ids:string[],transport?:(uid:string,payload:{id:string;title:string;body:string})=>Promise<unknown>){
 if(!ids.length)return;
 const {sendPushNotification}=await import('./reminders');const {userLanguage}=await import('./user-language');
 for(const id of ids){
  const [notice]=await db().select().from(s.feedbackNotices).where(eq(s.feedbackNotices.id,id));if(!notice||notice.pushState!=='pending')continue;
  const [prefs]=await db().select({enabled:s.profiles.pushEnabled}).from(s.profiles).where(eq(s.profiles.userId,notice.userId));
  if(!prefs?.enabled){await db().update(s.feedbackNotices).set({pushState:'skipped'}).where(eq(s.feedbackNotices.id,id));continue;}
  const claimed=await db().update(s.feedbackNotices).set({pushState:'sending'}).where(and(eq(s.feedbackNotices.id,id),eq(s.feedbackNotices.pushState,'pending'))).returning();if(!claimed.length)continue;
  try{const en=await userLanguage(notice.userId)==='en';await (transport||sendPushNotification)(notice.userId,{id:(isFeedbackAdmin((await profile(notice.userId)).role)?'feedback-team-':'feedback-')+id,title:'AutoCare · Feedback',body:en?'An update is available in your feedback inbox.':'Ai o actualizare în secțiunea Feedback.'});await db().update(s.feedbackNotices).set({pushState:'sent'}).where(eq(s.feedbackNotices.id,id));}
  catch{await db().update(s.feedbackNotices).set({pushState:'failed'}).where(eq(s.feedbackNotices.id,id));console.error(JSON.stringify({event:'feedback_push_failed',noticeId:id}));}
 }
}
