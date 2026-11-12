import {eq} from 'drizzle-orm';
import {db} from './db';
import {settings} from './schema';
export const languagePreferenceKey=(uid:string)=>`interface-language:${uid}`;
export async function userLanguage(uid:string):Promise<'ro'|'en'> {
 const row=(await db().select().from(settings).where(eq(settings.key,languagePreferenceKey(uid))))[0];
 return (row?.value as {language?:string}|undefined)?.language==='en'?'en':'ro';
}
