import { TechnologyNavigation } from '@/components/technology-navigation';
import './product-intro.css';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  ShieldCheck,
  Wrench,
  Files,
  CarFront,
} from 'lucide-react';
import LuxuryExperience, { LuxuryMotion } from '@/components/luxury-experience';
import { pricing, DEFAULT_PRICING } from '@/lib/pricing';
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
  const prices =
    process.env.DATABASE_URL || process.env.LOCAL_DATABASE_PATH ? await pricing() : DEFAULT_PRICING;
  const money = (bani: number) =>
    new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(bani / 100);
  return (
    <div className="ac-lux-public ac-studio-public">
      <PublicShell>
        <LuxuryMotion />
        <main>
          <section className="studio-landing-hero">
            <div className="studio-landing-copy">
              <p className="lux-eyebrow">AUTOCARE PREMIUM</p>
              <h1>
                Mașina ta. <span>Drumurile tale.</span>
              </h1>
              <p>
                Înregistrează călătoriile prin GPS și urmărește kilometrajul, reviziile, documentele și costurile fiecărei mașini din același garaj digital.
              </p>
              <div className="studio-landing-actions">
                <Link href="/inregistrare" className="lux-primary">
                  Începe gratuit <ArrowUpRight size={20} />
                </Link>
                <Link href="#aplicatia" className="lux-secondary">
                  Vezi aplicația
                </Link>
              </div>
              <div className="studio-landing-trust">
                <span>
                  <Check size={17} /> O mașină gratuită
                </span>
                <span>
                  <ShieldCheck size={17} /> Date private
                </span>
                <span>
                  <Check size={17} /> Fără card bancar
                </span>
              </div>
            </div>
            <figure className="studio-landing-photography product-hero-photo">
              <picture>
                <source
                  media="(max-width: 680px)"
                  srcSet="/images/aplicatie-intretinere-auto-640.webp"
                />
                <img
                  src="/images/aplicatie-intretinere-auto.webp"
                  width={1280}
                  height={854}
                  fetchPriority="high"
                  alt="Automobil de prezentare AutoCare"
                />
              </picture>
            </figure>
          </section>
          <div className="lux-capabilities" aria-label="Funcționalități AutoCare">
            <span>
              <Wrench size={17} />
              Întreținere
            </span>
            <span>
              <Files size={17} />
              Documente
            </span>
            <span>
              <CarFront size={17} />
              Garaj digital
            </span>
            <span>
              <ShieldCheck size={17} />
              Date private
            </span>
          </div>
          <section className="ac-product-systems" id="aplicatia">
            <header>
              <p className="lux-eyebrow">SISTEME AUTOCARE</p>
              <h2>De la drum la următoarea revizie</h2>
              <p>Înregistrezi drumul cu Smart GPS, apoi vezi kilometrii rămași până la următoarea lucrare. Harta te ajută să găsești servicii în zona pe care o alegi.</p>
            </header>
            <TechnologyNavigation/>
          </section>
          <LuxuryExperience />
          <section className="lux-premium" data-reveal>
            <div>
              <p className="lux-eyebrow">AUTOCARE PREMIUM</p>
              <h2>
                Mai multe mașini.
                <br />
                <span>Un singur garaj.</span>
              </h2>
              <p>Planifică lucrările și consultă rapoartele pentru fiecare mașină.</p>
              <ul>
                {[
                  'Mașini nelimitate, organizate individual',
                  'Istoric, documente și cheltuieli',
                  'Rapoarte și exporturi PDF / CSV',
                  'Estimări de întreținere din datele tale',
                ].map((text) => (
                  <li key={text}>
                    <Check size={16} />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lux-pricing-card">
              <span>PREMIUM LUNAR</span>
              <div>
                <strong>{money(prices.monthlyBani)}</strong>
                <span>lei / lună</span>
              </div>
              <p>sau {money(prices.annualBani)} lei / an</p>
              <Link href="/preturi" className="lux-primary">
                Alege planul potrivit <ArrowUpRight size={18} />
              </Link>
              <Link href="/comparatie" className="lux-text-link">
                Compară Gratuit și Premium <ArrowUpRight size={16} />
              </Link>
              <small>Prețul final și condițiile sunt afișate înainte de plată.</small>
            </div>
          </section>
          <section className="lux-plan-compare" data-reveal>
            <div className="lux-section-heading">
              <p className="lux-eyebrow">ALEGI CE ȚI SE POTRIVEȘTE</p>
              <h2>
                Gratuit pentru început.
                <br />
                <span>Premium pentru mai mult control.</span>
              </h2>
            </div>
            <div className="lux-compare-scroll">
              <table>
                <caption>Comparație între funcțiile existente ale planurilor AutoCare</caption>
                <thead>
                  <tr>
                    <th scope="col">Funcționalitate</th>
                    <th scope="col">Gratuit</th>
                    <th scope="col">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Mașini active', '1', 'Nelimitate'],
                    ['Documente și istoric de bază', 'Incluse', 'Incluse'],
                    ['Intervale pe operațiune', 'Istoric de bază', 'Configurabile'],
                    ['Rapoarte PDF și CSV', '—', 'Incluse'],
                    ['Statistici și cost per km', '—', 'Cu date suficiente'],
                    ['Export date personale JSON', 'Inclus', 'Inclus'],
                  ].map(([label, free, premium]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{free}</td>
                      <td>{premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href="/comparatie" className="lux-text-link">
              Vezi toate limitele și condițiile <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="lux-final" data-reveal>
            <p className="lux-eyebrow">CONT GRATUIT</p>
            <h2>Deschide garajul tău digital</h2>
            <Link href="/inregistrare" className="lux-primary">
              Începe cu prima mașină <ArrowUpRight size={18} />
            </Link>
            <Link href="/ghiduri" className="lux-text-link">
              Citește ghidurile practice
            </Link>
          </section>
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
                featureList: [
                  'Documente RCA, ITP și rovinietă',
                  'Istoric service și kilometraj',
                  'Cheltuieli auto',
                  'Sesiuni SmartDrive',
                ],
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
                primaryImageOfPage: {
                  '@type': 'ImageObject',
                  url: origin() + '/images/autocare-app-premium.webp',
                  caption: 'AutoCare — aplicație pentru documente, întreținere și cheltuieli auto',
                },
              },
            ],
          }}
        />
      </PublicShell>
    </div>
  );
}
