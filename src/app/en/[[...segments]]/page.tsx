import Link from 'next/link';
import {notFound} from 'next/navigation';
import {PublicShell} from '@/components/public-shell';
import {AuthForm} from '@/components/auth-form';
import {PriceCards} from '@/components/membership';
import MobileInstall from '@/components/mobile-install';
import {JsonLd} from '@/components/seo-content';
import {publicRoutePairs,romanianPublicPath,localizedPublicPath} from '@/lib/public-routes';
import {englishPage,englishGuide} from '@/lib/public-content';
import {publicMetadata,indexableSlugs} from '@/lib/seo';
import {origin} from '@/lib/config';
import {guides} from '@/lib/guides';
import {publicPricing,DEFAULT_PRICING} from '@/lib/pricing';
import {discoveryPagesEn} from '@/lib/discovery-pages';
import {technologyPages} from '@/lib/public-technology';
type Props={params:Promise<{segments?:string[]}>;searchParams:Promise<{next?:string;token?:string}>};
const auth:Record<string,string>={'/autentificare':'Sign in','/inregistrare':'Create account','/recuperare-parola':'Reset password','/resetare-parola':'New password'};
export function generateStaticParams(){return Object.entries(publicRoutePairs).filter(([ro])=>!auth[ro]).map(([,en])=>({segments:en.slice(4).split('/').filter(Boolean)}));}
function contentFor(ro:string) {
 if(ro==='/')return {title:'Car management, documents and maintenance app',intro:'Manage vehicle documents, service history, mileage and expenses in one private digital garage. AutoCare works on your phone and computer.',sections:[['Everything about your vehicle, in one place','Start with one vehicle on the free plan. Keep document expiry dates, maintenance records and costs linked to the right vehicle. Premium adds more vehicles, reports and AutoCare AI.'],['Useful records, without invented data','Review the information you save, plan maintenance from your vehicle’s confirmed intervals and check original documents before acting on reminders. AutoCare is an organization tool, not an official vehicle-history database.']]};
 if(ro==='/aplicatie-auto')return {title:'Car management app for Android and web',intro:'Organize insurance, inspections, maintenance, mileage and expenses with the same AutoCare account on phone and desktop.',sections:[['Web and Android experiences','Use the web app in a compatible browser or the available Android installer. Store publication is separate; AutoCare does not claim an available Google Play or App Store listing.'],['GPS and Bluetooth availability','Start GPS manually in a browser while keeping the app open. Background GPS needs native permissions. Car-audio Bluetooth automation is Android-specific and does not provide OBD readings.']]};
 if(ro==='/instaleaza')return {title:'Install AutoCare on your phone',intro:'Add the web app to your home screen and keep using the same account.',sections:[['Android','Open AutoCare in Chrome. Use the browser menu to choose Install app or Add to Home screen, then confirm.'],['iPhone and iPad','Open AutoCare in Safari. Tap Share, Add to Home Screen, then Add. Background GPS and Bluetooth features require the appropriate native app and permissions.']]};
 if(ro==='/ghiduri')return {title:'Vehicle management guides',intro:'Practical guides for document expiry dates, service history and vehicle expenses.',sections:[]};
 if(['/preturi','/comparatie'].includes(ro))return {title:'AutoCare pricing — Free and Premium plans',intro:'Start with one vehicle for free. Choose RON or EUR for monthly, three-month or annual Premium billing.',sections:[]};
 if(auth[ro])return {title:auth[ro],intro:'Access your private AutoCare garage securely.',sections:[]};
 return ro.startsWith('/ghiduri/')?englishGuide(ro.slice(9)):englishPage(ro.slice(1));
}
export async function generateMetadata({params}:Props){
 const {segments=[]}=await params;const path='/en'+(segments.length?'/'+segments.join('/'):'');
 const ro=romanianPublicPath(path);const content=ro&&contentFor(ro);if(!content)return {};
 const canonical=ro==='/comparatie'?'/en/pricing':path;
 const meta=publicMetadata(content.title,('intro' in content?content.intro:content.description),canonical);
 const index=ro==='/'||ro==='/ghiduri'||ro.startsWith('/ghiduri/')||indexableSlugs.includes(ro.slice(1));
 return {...meta,title:{absolute:content.title+' | AutoCare'},openGraph:{...meta.openGraph,locale:'en_GB',alternateLocale:['ro_RO'],images:[{url:origin()+'/opengraph-image',width:1200,height:630,alt:'AutoCare — vehicle documents, maintenance and expenses'}]},robots:{index,follow:!auth[ro]}};
}
export default async function EnglishPublicPage({params,searchParams}:Props){
 const {segments=[]}=await params;const path='/en'+(segments.length?'/'+segments.join('/'):'');
 const ro=romanianPublicPath(path);const page=ro&&contentFor(ro);if(!ro||!page||!Object.values(publicRoutePairs).includes(path))notFound();
 const description='intro' in page?page.intro:page.description;
 if(auth[ro]){const {next}=await searchParams;return <PublicShell language="en"><AuthForm mode={ro.slice(1)} initialLanguage="en" next={next?.startsWith('/cont?')?next:'/cont'}/></PublicShell>;}
 const isPrice=ro==='/preturi'||ro==='/comparatie';
 const prices=isPrice&&(process.env.DATABASE_URL||process.env.LOCAL_DATABASE_PATH)?await publicPricing():DEFAULT_PRICING;
 return <PublicShell language="en" dark landing={ro==='/'}><main className="content-page seo-content ac-public-editorial">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/en">Home</Link>{ro!=='/'&&<> / <span aria-current="page">{page.title}</span></>}</nav>
  <header className="ac-editorial-hero"><p className="eyebrow">AUTOCARE PREMIUM</p><h1>{page.title}</h1><p>{description}</p></header>
  <div className="ac-editorial-sections">{page.sections.map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}</div>
  {isPrice&&<PriceCards language="en" monthlyBani={prices.monthlyBani} annualBani={prices.annualBani}/>}
  {ro==='/instaleaza'&&<MobileInstall/>}
  {ro==='/ghiduri'&&<div className="seo-guide-grid">{Object.keys(guides).map(slug=>{const guide=englishGuide(slug)!;return <article className="card" key={slug}><h2><Link href={localizedPublicPath('/ghiduri/'+slug,'en')}>{guide.title}</Link></h2><p>{guide.description}</p></article>;})}</div>}
  <section className="card"><h2>Explore AutoCare</h2><div className="footer-links">{Object.entries(discoveryPagesEn).map(([slug,content])=><Link key={slug} href={publicRoutePairs['/'+slug]}>{content.title}</Link>)}{['documente-auto','intretinere-auto','cheltuieli-auto','autocare-ai',...Object.keys(technologyPages)].map(slug=><Link key={slug} href={publicRoutePairs['/'+slug]}>{englishPage(slug)?.title}</Link>)}</div></section>
  {!['confidentialitate','termeni','cookie-uri'].includes(ro.slice(1))&&<div className="actions"><Link className="button primary" href="/en/sign-up">Create a free account</Link><Link className="button ghost" href="/en/pricing">View plans</Link></div>}
  <JsonLd value={{'@context':'https://schema.org','@type':ro.startsWith('/ghiduri/')?'Article':'WebPage',name:page.title,description,inLanguage:'en-GB',url:origin()+path}}/>
  {ro==='/intrebari-frecvente'&&<JsonLd value={{'@context':'https://schema.org','@type':'FAQPage',mainEntity:page.sections.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))}}/>}
 </main></PublicShell>;
}
