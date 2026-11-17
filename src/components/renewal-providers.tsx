import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { insuranceProviders,roadPortals } from '@/lib/renewal-documents';
export function RenewalProviders({english=false}:{english?:boolean}) {
 const t=(ro:string,en:string)=>english?en:ro;
 return <section className="ac-renewal-providers" aria-labelledby="rca-providers-title" data-workspace-ui>
  <h2 id="rca-providers-title">{t('Compară oferte RCA','Compare RCA quotes')}</h2>
  <p>{t('Compară același profil, aceeași perioadă și aceleași opțiuni. Prețul final este afișat de furnizor.','Compare the same profile, period and options. The provider displays your final price.')}</p>
  <div className="ac-renewal-grid">{insuranceProviders.map(provider=><article className="card" key={provider.name}><ShieldCheck size={24}/><h3>{provider.name}</h3><p>{english?provider.en:provider.ro}</p><a className="button" href={provider.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t('Compară ofertele','Compare quotes')}<ArrowUpRight size={16}/></a><small>{provider.operator}</small></article>)}</div>
  <p className="small muted">{t('Identitatea și codurile de mai sus sunt declarate de platforme. Consultă situația actuală în ','The identities and codes above are declared by the platforms. Check their current status in the ')}<a href={roadPortals.registry} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{t('registrul ASF','ASF register')}</a>.</p>
  <p className="small muted">{t('AutoCare organizează documentele tale; nu intermediază asigurări și nu vinde roviniete. Linkurile deschid platforme externe. Nu trimitem automat date personale și nu confirmăm cumpărarea. După reînnoire, actualizează documentul din cont.','AutoCare organises your documents; it does not broker insurance or sell road vignettes. Links open external platforms. We do not automatically send personal data or confirm purchases. After renewal, update your document in your account.')}</p>
 </section>;
}
