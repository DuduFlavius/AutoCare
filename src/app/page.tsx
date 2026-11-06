import './product-intro.css';
import Link from 'next/link';
import {ArrowUpRight, Check, ShieldCheck, Wrench, Files, CarFront} from 'lucide-react';
import LuxuryExperience, {LuxuryMotion} from '@/components/luxury-experience';
import {pricing, DEFAULT_PRICING} from '@/lib/pricing';
import './luxury-public.css';
import './studio-public.css';
import { PublicShell } from '@/components/public-shell';
import { appName, origin } from '@/lib/config';
import { publicMetadata, siteDescription } from '@/lib/seo';
import { JsonLd } from '@/components/seo-content';
import { googleVerification } from '@/lib/google-verification-server';
export async function generateMetadata() {
  const verification = await googleVerification();
  return {
    ...(verification ? { verification: { google: verification } } : {}),
    ...publicMetadata(
      'AutoCare – Aplicație pentru Întreținerea și Gestionarea Mașinii',
      siteDescription,
      '/',
    ),
    title: { absolute: 'AutoCare – Aplicație pentru Întreținerea și Gestionarea Mașinii' },
  };
}
export default async function Home() {
  const prices=process.env.DATABASE_URL||process.env.LOCAL_DATABASE_PATH?await pricing():DEFAULT_PRICING;
  const money=(bani:number)=>new Intl.NumberFormat('ro-RO',{maximumFractionDigits:2}).format(bani/100);
  return (
    <div className="ac-lux-public ac-studio-public"><PublicShell><LuxuryMotion/>
      <main>
        <section className="studio-landing-hero"><div className="studio-landing-copy"><p className="lux-eyebrow">AUTOCARE PREMIUM · GARAJ DIGITAL</p><h1>Mai mult control.<br/><span>La fiecare drum.</span></h1><p>Un singur loc pentru mașină, documente, întreținere și costuri. Vezi ce urmează. Păstrează ce contează.</p><div className="studio-landing-actions"><Link href="/inregistrare" className="lux-primary">Creează-ți garajul gratuit <ArrowUpRight size={20}/></Link><Link href="/cum-functioneaza" className="lux-secondary">Vezi cum funcționează</Link></div><div className="studio-landing-trust"><span><Check size={17}/>O mașină gratuită</span><span><ShieldCheck size={17}/>Date private</span><span><Check size={17}/>Fără card bancar</span></div></div><div className="studio-landing-photography"><img src="/images/autocare-studio-coupe.webp" width={1200} height={675} fetchPriority="high" alt="Imagine auto de prezentare: coupe grafit într-un studio modern"/><div className="studio-photo-label"><Wrench size={20}/><span>Grija pentru mașină.<strong>Organizată, de la primul kilometru.</strong></span></div><span className="studio-landing-photo-note">Imagine ilustrativă AutoCare</span></div></section>
        <div className="lux-capabilities" aria-label="Funcționalități AutoCare"><span><Wrench size={17}/>Întreținere</span><span><Files size={17}/>Documente</span><span><CarFront size={17}/>Garaj digital</span><span><ShieldCheck size={17}/>Date private</span></div>
        <LuxuryExperience/>
        <section className="lux-premium" data-reveal><div><p className="lux-eyebrow">AUTOCARE PREMIUM</p><h2>Mai multă claritate.<br/><span>Pentru întregul tău garaj.</span></h2><p>Mai multe mașini, planificare avansată și rapoarte. Instrumentele de care ai nevoie ca să vezi imaginea completă.</p><ul>{['Mașini nelimitate, organizate individual','Istoric, documente și cheltuieli','Rapoarte și exporturi PDF / CSV','Estimări de întreținere din datele tale'].map(text=><li key={text}><Check size={16}/>{text}</li>)}</ul></div><div className="lux-pricing-card"><span>PREMIUM LUNAR</span><div><strong>{money(prices.monthlyBani)}</strong><span>lei / lună</span></div><p>sau {money(prices.annualBani)} lei / an</p><Link href="/preturi" className="lux-primary">Alege planul potrivit <ArrowUpRight size={18}/></Link><Link href="/comparatie" className="lux-text-link">Compară Gratuit și Premium <ArrowUpRight size={16}/></Link><small>Prețul final și condițiile sunt afișate înainte de plată.</small></div></section>
        <section className="lux-plan-compare" data-reveal><div className="lux-section-heading"><p className="lux-eyebrow">ALEGI CE ȚI SE POTRIVEȘTE</p><h2>Gratuit pentru început.<br/><span>Premium pentru mai mult control.</span></h2></div><div className="lux-compare-scroll"><table><caption>Comparație între funcțiile existente ale planurilor AutoCare</caption><thead><tr><th scope="col">Funcționalitate</th><th scope="col">Gratuit</th><th scope="col">Premium</th></tr></thead><tbody>{[
          ['Mașini active','1','Nelimitate'],['Documente și istoric de bază','Incluse','Incluse'],['Intervale pe operațiune','Istoric de bază','Configurabile'],['Rapoarte PDF și CSV','—','Incluse'],['Statistici și cost per km','—','Cu date suficiente'],['Export date personale JSON','Inclus','Inclus'],
        ].map(([label,free,premium])=><tr key={label}><th scope="row">{label}</th><td>{free}</td><td>{premium}</td></tr>)}</tbody></table></div><Link href="/comparatie" className="lux-text-link">Vezi toate limitele și condițiile <ArrowUpRight size={16}/></Link></section>
        <section className="lux-final" data-reveal><p className="lux-eyebrow">GATA PENTRU URMĂTORUL DRUM?</p><h2>Mașina ta merită<br/>un garaj pe măsură.</h2><Link href="/inregistrare" className="lux-primary">Începe cu prima mașină <ArrowUpRight size={18}/></Link><Link href="/ghiduri" className="lux-text-link">Citește ghidurile practice</Link></section>
      </main>
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': origin() + '/#organization',
              name: appName,
              url: origin(),
              logo: origin() + '/icon-512.png',
            },
            {
              '@type': 'WebSite',
              '@id': origin() + '/#website',
              name: appName,
              url: origin(),
              inLanguage: 'ro-RO',
              publisher: { '@id': origin() + '/#organization' },
            },
            {
              '@type': 'SoftwareApplication',
              name: appName,
              url: origin(),
              description: siteDescription,
              applicationCategory: 'LifestyleApplication',
              operatingSystem: 'Android, Web',
              '@id': origin() + '/#application',
              publisher: { '@id': origin() + '/#organization' },
              featureList: ['Documente RCA, ITP și rovinietă', 'Istoric service și kilometraj', 'Cheltuieli auto', 'Sesiuni SmartDrive'],
              inLanguage: 'ro-RO',
              image: origin() + '/images/autocare-app-premium.webp',
              screenshot: origin() + '/images/autocare-app-premium.webp',
              installUrl: origin() + '/aplicatie-auto',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'RON',
                url: origin() + '/preturi',
                description: 'Plan gratuit cu o mașină activă',
              },
            },
            {
              '@type': 'WebPage',
              url: origin(),
              name: 'AutoCare – Aplicație pentru Întreținerea și Gestionarea Mașinii',
              '@id': origin() + '/#webpage',
              isPartOf: { '@id': origin() + '/#website' },
              about: { '@id': origin() + '/#application' },
              primaryImageOfPage: { '@type': 'ImageObject', url: origin() + '/images/autocare-app-premium.webp', caption: 'AutoCare — aplicație pentru documente, întreținere și cheltuieli auto' },
            },
          ],
        }}
      />
    </PublicShell></div>
  );
}
