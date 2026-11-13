import { pages } from './pages';
import { guides } from './guides';
import { translateApplicationCopy } from './application-language';
import { discoveryPagesEn } from './discovery-pages';
export const englishCopy=(text:string)=>translateApplicationCopy(text,'en');
export function englishPage(slug:string) {
 const original=pages[slug]; if(!original)return null;
 const dedicated=discoveryPagesEn[slug as keyof typeof discoveryPagesEn];
 return dedicated??{title:englishCopy(original.title),intro:englishCopy(original.intro),sections:original.sections.map(([a,b])=>[englishCopy(a),englishCopy(b)])};
}
export function englishGuide(slug:string){
 const guide=guides[slug as keyof typeof guides]; if(!guide)return null;
 return {...guide,title:englishCopy(guide.title),description:englishCopy(guide.description),sections:guide.sections.map(([a,b])=>[englishCopy(a),englishCopy(b)])};
}
