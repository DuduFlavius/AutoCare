import Link from 'next/link';
import { ArrowUpRight, Bell, CarFront, ChartNoAxesCombined, Download, Files, MapPin, Sparkles, Wrench } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { JsonLd } from '@/components/seo-content';
import { brandGraph, homeDescription, homeTitle, publicMetadata } from '@/lib/seo';
import { googleVerification } from '@/lib/google-verification-server';
import '@/app/public-brand.css';

export async function generateMetadata() {
  const verification = await googleVerification();
  return {
    ...publicMetadata(homeTitle, homeDescription, '/'),
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

const features = [
  { icon: CarFront, title: 'Garaj digital', href: '/garaj-digital', description: 'Adună istoricul și informațiile fiecărei mașini într-un singur loc.' },
  { icon: MapPin, title: 'SmartDrive GPS', href: '/smartdrive-gps', description: 'Planifică destinații, primește indicații și salvează traseele pe Android.' },
  { icon: Sparkles, title: 'AutoCare AI', href: '/autocare-ai', description: 'Pune întrebări despre revizii, documente sau costuri. Disponibil în Premium.' },
  { icon: Wrench, title: 'Revizii și întreținere', href: '/intretinere-auto', description: 'Vezi lucrările efectuate și planifică următoarea revizie după dată sau kilometraj.' },
  { icon: Files, title: 'Documente auto', href: '/documente-auto', description: 'Păstrează actele și urmărește termenele pentru RCA, ITP, rovinietă și CASCO.' },
  { icon: ChartNoAxesCombined, title: 'Cheltuieli și statistici', href: '/cheltuieli-auto', description: 'Organizează costurile și compară cheltuielile pe vehicul și pe perioadă.' },
  { icon: Bell, title: 'Notificări și remindere', href: '/cum-functioneaza', description: 'Alege când vrei să primești notificări înainte de termenele înregistrate.' },
];

export default function Home() {
  return (
    <div className="ac-brand-home">
      <PublicShell landing>
        <main id="continut">
          <section className="ac-brand-hero" aria-labelledby="ac-brand-title">
            <div className="ac-brand-hero-copy">
              <p className="ac-brand-kicker">AutoCare România</p>
              <h1 id="ac-brand-title">Mașina ta.<br />{' '}Totul sub control.</h1>
              <p className="ac-brand-intro">Documentele, reviziile și costurile mașinii, într-un singur garaj digital. Știi ce expiră, ce ai făcut și ce urmează.</p>
              <div className="ac-brand-actions">
                <Link prefetch={false} className="ac-brand-primary" href="/inregistrare">Începe acum <ArrowUpRight size={17} aria-hidden="true"/></Link>
                <Link prefetch={false} className="ac-brand-secondary" href="/descarca"><Download size={17} aria-hidden="true"/> Descarcă aplicația Android</Link>
              </div>
              <p className="ac-brand-plan">O mașină în planul gratuit. Fără card la înscriere.</p>
            </div>
            <figure className="ac-brand-product">
              {/* Prepared WebP from the current desktop app, with demo account data. */}
              <img src="/images/autocare-capture-garage.webp"
                srcSet="/images/autocare-capture-garage-small.webp 640w, /images/autocare-capture-garage.webp 1180w"
                sizes="(max-width: 740px) 90vw, (max-width: 1350px) 42vw, 570px" width={1180} height={670} alt="Interfața AutoCare cu o mașină, termenele documentelor și întreținerea în același tablou de bord" fetchPriority="high"/>
              <figcaption>Captură din aplicația AutoCare, cu date demonstrative.</figcaption>
            </figure>
          </section>

          <section className="ac-brand-features" aria-labelledby="ac-brand-features-title">
            <header><h2 id="ac-brand-features-title">Tot ce ține de mașină, la un loc</h2></header>
            <div className="ac-brand-grid">
              {features.map(({ icon: Icon, title, description, href }) => (
                <Link prefetch={false} className="ac-brand-card" href={href} key={href}>
                  <span className="ac-brand-feature-icon"><Icon size={23} aria-hidden="true"/></span>
                  <ArrowUpRight className="ac-brand-card-arrow" size={17} aria-hidden="true"/>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="ac-brand-bottom">
            <div><h2>Începe cu prima ta mașină</h2><p>Deschide un cont gratuit și adaugă primul vehicul.</p></div>
            <div className="ac-brand-actions"><Link prefetch={false} className="ac-brand-primary" href="/inregistrare">Creează cont <ArrowUpRight size={17} aria-hidden="true"/></Link><Link prefetch={false} className="ac-brand-text" href="/preturi">Vezi planurile</Link></div>
          </section>
        </main>
        <JsonLd value={brandGraph()}/>
      </PublicShell>
    </div>
  );
}
