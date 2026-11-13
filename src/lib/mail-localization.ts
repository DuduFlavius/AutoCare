import {z} from 'zod';
import {eq} from 'drizzle-orm';
import {db} from './db';
import {settings} from './schema';
export const englishMailSchema=z.object({subject:z.string().trim().min(3).max(180).refine(x=>!/[\r\n]/.test(x)),message:z.string().trim().min(10).max(8000),ctaLabel:z.string().trim().min(2).max(60)}).strict();
export async function campaignEnglish(id:string){
 const row=(await db().select().from(settings).where(eq(settings.key,'mail-english:'+id)))[0];
 const result=englishMailSchema.safeParse(row?.value);
 return result.success?result.data:null;
}
