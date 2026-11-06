import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { Breadcrumbs } from '@/components/seo-content';
import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata(
  'Aplicație auto pentru Android și web – AutoCare',
  'AutoCare organizează RCA, ITP, rovinieta, reviziile, kilometrajul și cheltuielile mașinii. Descoperă garajul digital pentru Android și web.',
  '/aplicatie-auto',
);
export default function AppOverview() {
  return <PublicShell><main className="content-page seo-content">
    <Breadcrumbs items={[{ name: 'Aplicație auto', path: '/aplicatie-auto' }]} />
    <p className="eyebrow">AUTOCARE · ANDROID ȘI WEB</p>
    <h1>Aplicația care pune în ordine tot ce ține de mașina ta.</h1>
    <p>AutoCare este un garaj digital pentru documente, întreținere, kilometraj și cheltuieli auto. Ai aceeași evidență în contul tău, pe telefon și pe calculator.</p>
    <img src="/images/autocare-app-premium.webp" width={1672} height={940} alt="Prezentare vizuală AutoCare: documente auto și termene organizate" style={{width:'100%',height:'auto',borderRadius:24}} />
    <h2>Ce poți gestiona în AutoCare?</h2>
    <p><Link href="/documente-auto">RCA, ITP și rovinieta</Link>, cu date de expirare și mementouri configurabile. Păstrezi fotografii sau PDF-uri în cont, în limitele planului ales.</p>
    <p><Link href="/intretinere-auto">Revizii și intervenții</Link>, cu data, kilometrajul și costul lucrării. Urmărești schimbul de ulei și distribuția pe baza intervalelor completate pentru mașina ta.</p>
    <p><Link href="/cheltuieli-auto">Cheltuieli auto</Link> grupate după mașină și categorie, pentru a înțelege mai ușor costurile înregistrate.</p>
    <h2>Cum funcționează SmartDrive?</h2>
    <p>SmartDrive păstrează sesiuni de condus cu durată, distanță și traseu GPS. Pe Android, conectarea la dispozitivul Bluetooth configurat al mașinii poate pregăti urmărirea; deplasarea trebuie confirmată de GPS înainte să fie înregistrată o călătorie automată. Permisiunile de localizare și setările telefonului influențează funcționarea în fundal.</p>
    <p>Distanța GPS este o măsurătoare a traseului, nu o citire a odometrului din calculatorul mașinii. Verifică kilometrajul real atunci când faci o intervenție.</p>
    <h2>Instalează AutoCare pe Android</h2>
    <div className="actions"><a href="/downloads/AutoCare-1.2.1.apk" className="button primary" download>Descarcă AutoCare 1.2.1 pentru Android</a></div>
    <p>La trecerea de la versiunile vechi, sincronizează mai întâi toate traseele din cont. Dacă Android semnalează un conflict de semnătură, dezinstalează versiunea veche abia după sincronizare, apoi instalează acest APK și autentifică-te în același cont.</p>
    <p>AutoCare are o aplicație Android și o versiune web. Disponibilitatea instalării și actualizărilor este afișată în cont. Publicarea în Google Play este o etapă separată; aici nu prezentăm o listare care încă nu există.</p>
    <h2>Cât costă?</h2>
    <p>Poți începe cu o mașină în planul gratuit. Consultă <Link href="/preturi">prețurile și limitele actuale</Link> înainte de a alege Premium.</p>
    <div className="actions"><Link href="/inregistrare" className="button primary">Începe gratuit</Link><Link href="/ghiduri" className="button ghost">Ghiduri practice</Link></div>
  </main></PublicShell>;
}
