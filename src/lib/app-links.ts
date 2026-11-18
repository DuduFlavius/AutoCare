export const androidPackage='ro.autocare.garage';
export const androidLinkHost='www.autocareapp.ro';
/** Keep launch destinations inside the existing website, never in an API. */
export function safeAppDestination(value:unknown):string {
 if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//')||value.includes(String.fromCharCode(92))||Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)||/%(?:5c|0a|0d)/i.test(value))return '/cont';
 try{const url=new URL(value,'https://'+androidLinkHost);if(/%(2f|5c|2e)/i.test(url.pathname))return '/cont';if(url.origin!=='https://'+androidLinkHost||url.pathname==='/open-app'||url.pathname.startsWith('/open-app/')||url.pathname==='/api'||url.pathname.startsWith('/api/'))return '/cont';return url.pathname+url.search+url.hash;}catch{return '/cont';}
}
export function androidAppIntent(destination:string){
 const link='https://'+androidLinkHost+'/open-app?next='+encodeURIComponent(safeAppDestination(destination));
 return link.replace('https://','intent://')+'#Intent;scheme=https;package='+androidPackage+';S.browser_fallback_url='+encodeURIComponent('https://'+androidLinkHost+'/instaleaza')+';end';
}
