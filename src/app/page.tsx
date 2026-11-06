import './product-intro.css';
import Link from 'next/link';
import {ArrowUpRight, Check, ShieldCheck, Wrench, Files, CarFront} from 'lucide-react';
import LuxuryExperience, {LuxuryMotion} from '@/components/luxury-experience';
import {pricing, DEFAULT_PRICING} from '@/lib/pricing';
import './luxury-public.css';
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
    <div className="ac-lux-public"><PublicShell><LuxuryMotion/>
      <main>
        <section className="lux-hero">
          <div className="lux-hero-media lux-abstract-stage" aria-hidden="true"><div className="lux-abstract-grid"/><div className="lux-abstract-orbit"/><div className="lux-abstract-core"><ShieldCheck size={70} strokeWidth={1}/><span>AUTOCARE</span></div><div className="lux-floating-panel lux-floating-panel--one"><Files size={22}/><span>Documente<small>Organizate. Private.</small></span><i/></div><div className="lux-floating-panel lux-floating-panel--two"><Wrench size={22}/><span>Întreținere<small>Fiecare lucrare, în context.</small></span></div><div className="lux-floating-panel lux-floating-panel--three"><Check size={18}/><span>Totul într-un singur loc.</span></div></div>
          <div className="lux-hero-shade"/>
          <div className="lux-hero-copy"><p className="lux-eyebrow">AUTOCARE · GARAJUL TĂU DIGITAL</p><h1>Tu alegi drumul.<br/><span>Noi păstrăm<br/>totul în ordine.</span></h1><p>Documente, întreținere, kilometri și cheltuieli. Un singur spațiu pentru tot ce contează la mașina ta.</p><div className="lux-hero-actions"><Link href="/inregistrare" className="lux-primary">Deschide garajul gratuit <ArrowUpRight size={18}/></Link><Link href="/autentificare" className="lux-secondary">Intră în cont <ArrowUpRight size={16}/></Link></div><small><Check size={14}/>O mașină gratuită · Fără card bancar</small></div>
          <div className="lux-hero-bottom"><span>MAI MULT CONTROL. MAI PUȚINE GRIJI.</span><a href="#functii">Explorează AutoCare <span aria-hidden="true">↓</span></a></div>
        </section>
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
