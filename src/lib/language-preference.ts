export type InterfaceLanguage='ro'|'en';
/** Non-sensitive preference only; this cookie never authorizes access. */
export function languageCookie(header:string|null|undefined):InterfaceLanguage|null {
 const match=header?.match(/(?:^|;\s*)autocare-language=(ro|en)(?:;|$)/);
 return match?.[1]==='en'?'en':match?.[1]==='ro'?'ro':null;
}
export function saveBrowserLanguage(language:InterfaceLanguage){
 if(typeof document==='undefined')return;
 document.cookie=`autocare-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
 try{localStorage.setItem('autocare-language',language);}catch{/* The session preference remains usable. */}
}
