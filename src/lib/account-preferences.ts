import {z} from 'zod';
import {eq} from 'drizzle-orm';
import {db} from './db';
import * as s from './schema';
export const accountPreferencesKey=(uid:string)=>'account-preferences:'+uid;
export const accountPreferencesSchema=z.object({
 firstName:z.string().trim().max(80).default(''),lastName:z.string().trim().max(80).default(''),
 alerts:z.object({itp:z.boolean(),rca:z.boolean(),rovinieta:z.boolean(),service:z.boolean(),chat:z.boolean(),updates:z.boolean(),account:z.boolean()}).default({itp:true,rca:true,rovinieta:true,service:true,chat:true,updates:true,account:true}),
}).strict();
export async function accountPreferences(uid:string){
 const row=(await db().select().from(s.settings).where(eq(s.settings.key,accountPreferencesKey(uid))))[0];
 const parsed=accountPreferencesSchema.safeParse(row?.value??{});
 return parsed.success?parsed.data:accountPreferencesSchema.parse({});
}
export function reminderPreference(category:string,kind:string){
 const normalized=category.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(normalized.includes('itp'))return 'itp' as const;
 if(normalized.includes('rca')||normalized.includes('asigur'))return 'rca' as const;
 if(normalized.includes('rovin')||normalized.includes('vignet'))return 'rovinieta' as const;
 return kind==='service'?'service' as const:'account' as const;
}
