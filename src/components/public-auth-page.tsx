import {PublicShell} from './public-shell';
import {AuthForm} from './auth-form';
import {publicMetadata} from '@/lib/seo';
import {localizedPublicPath} from '@/lib/public-routes';
export type AuthMode='autentificare'|'inregistrare'|'recuperare-parola'|'resetare-parola';
export type AuthPageProps={searchParams:Promise<{next?:string}>};
const titles:Record<AuthMode,[string,string]>={autentificare:['Autentificare','Sign in'],inregistrare:['Creare cont','Create account'],'recuperare-parola':['Recuperare parolă','Reset password'],'resetare-parola':['Parolă nouă','New password']};
export function authPageMetadata(language:'ro'|'en',mode:AuthMode){
 const title=titles[mode][language==='en'?1:0];
 const base=publicMetadata(title,language==='en'?'Secure access to your private AutoCare garage.':'Acces securizat la garajul tău privat AutoCare.',localizedPublicPath('/'+mode,language));
 return {...base,openGraph:{...base.openGraph,locale:language==='en'?'en_GB':'ro_RO'},title:{absolute:title+' | AutoCare'},robots:{index:false,follow:false}};
}
export async function renderAuthPage(language:'ro'|'en',mode:AuthMode,{searchParams}:AuthPageProps){
 const {next}=await searchParams;
 return <PublicShell language={language}><AuthForm mode={mode} initialLanguage={language==='en'?'en':undefined} next={typeof next==='string'&&next.startsWith('/cont?')?next:'/cont'}/></PublicShell>;
}
