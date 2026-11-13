/** Stable, language-specific public URLs; private routes are deliberately excluded. */
export const publicRoutePairs: Record<string, string> = {
 '/':'/en', '/despre-noi':'/en/about', '/aplicatie-auto':'/en/car-management-app',
 '/instaleaza':'/en/install', '/functionalitati':'/en/features', '/cum-functioneaza':'/en/how-it-works',
 '/documente-auto':'/en/vehicle-documents', '/intretinere-auto':'/en/service-history',
 '/cheltuieli-auto':'/en/vehicle-expenses', '/smart-gps':'/en/gps-trip-tracking',
 '/bluetooth':'/en/car-bluetooth', '/smart-maintenance':'/en/maintenance-planning',
 '/autocare-maps':'/en/maps', '/contact':'/en/contact', '/preturi':'/en/pricing',
 '/comparatie':'/en/compare-plans', '/autocare-ai':'/en/automotive-ai',
 '/intrebari-frecvente':'/en/faq', '/confidentialitate':'/en/privacy', '/termeni':'/en/terms',
 '/autentificare':'/en/sign-in', '/inregistrare':'/en/sign-up', '/recuperare-parola':'/en/forgot-password', '/resetare-parola':'/en/reset-password',
 '/cookie-uri':'/en/cookies', '/ghiduri':'/en/guides',
 '/ghiduri/cum-urmaresti-expirarea-documentelor-auto':'/en/guides/track-document-expiry',
 '/ghiduri/cum-organizezi-istoricul-de-service':'/en/guides/keep-service-history',
 '/ghiduri/cum-tii-evidenta-cheltuielilor-cu-masina':'/en/guides/organize-vehicle-expenses',
 '/administrarea-masinii':'/en/car-management', '/garaj-digital':'/en/digital-garage',
 '/itp-rca':'/en/inspection-insurance-reminders', '/istoric-auto':'/en/vehicle-history',
 '/mai-multe-vehicule':'/en/multiple-vehicles',
};
export function romanianPublicPath(path:string) {
 const clean=path.replace(/\/$/,'')||'/';
 return Object.entries(publicRoutePairs).find(([,en])=>en===clean)?.[0] ?? (clean.startsWith('/en/')||clean==='/en'?null:clean);
}
export function localizedPublicPath(path:string, language:'ro'|'en') {
 const ro=romanianPublicPath(path);
 return ro ? (language==='en'?publicRoutePairs[ro]??ro:ro) : path;
}
export function publicLanguageAlternates(path:string,base:string) {
 const ro=romanianPublicPath(path); if(!ro||!publicRoutePairs[ro])return undefined;
 return {ro:new URL(ro,base).href,en:new URL(publicRoutePairs[ro],base).href,'x-default':new URL(ro,base).href};
}
