export function accountDisplayCurrency(language:'ro'|'en',saved?:string|null,savedLanguage?:string|null):'RON'|'EUR' {
 return savedLanguage===language&&(saved==='RON'||saved==='EUR')?saved:language==='en'?'EUR':'RON';
}
