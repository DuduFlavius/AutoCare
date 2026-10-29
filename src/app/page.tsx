import './product-intro.css';
import Link from 'next/link';
import {
  ShieldCheck,
  BellRing,
  Wrench,
  ArrowUpRight,
  Check,
  CarFront,
  ChartNoAxesCombined,
  Files,
} from 'lucide-react';
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
export default function Home() {
  return (
    <PublicShell>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">GARAJUL TĂU DIGITAL</p>
            <h1>
              Ai grijă de mașina ta.{' '}
              <span className="accent">Toate informațiile, într-un singur loc.</span>
            </h1>
            <p>
              AutoCare te ajută să îți organizezi documentele mașinii, să urmărești termenele
              importante, să păstrezi istoricul de întreținere și să înțelegi cheltuielile auto. Mai
              puțină dezordine, mai mult control asupra mașinii tale.
            </p>
            <div className="actions">
              <Link href="/inregistrare" className="button primary">
                Începe gratuit <ArrowUpRight size={18} />
              </Link>
              <Link href="#functii" className="button ghost">
                Descoperă funcțiile
              </Link>
            </div>
            <div className="micro inline">
              <Check size={15} /> O mașină gratuită · Fără card bancar
            </div>
          </div>
          <div className="cockpit ac-product-intro">
            <div className="between">
              <span className="eyebrow">UN LOC PENTRU MAȘINA TA</span>
              <CarFront size={22} className="accent" />
            </div>
            <img
              className="editorial-car ac-product-intro-art"
              src="/images/autocare-app-premium.webp"
              srcSet="/images/autocare-app-premium-mobile.webp 768w, /images/autocare-app-premium.webp 1400w"
              sizes="(max-width: 760px) 92vw, 48vw"
              width={1672}
              height={940}
              fetchPriority="high"
              loading="eager"
              alt="Ilustrație AutoCare cu documente, calendar și scut cu bifă"
            />
            <h3>Mai multă liniște, la fiecare drum.</h3>
            <p className="small muted">Documente, termene și istoric. În ordine, într-un singur loc.</p>
            <div className="list">
              <div className="list-row">
                <span className="list-icon">
                  <ShieldCheck size={21} />
                </span>
                <div className="list-grow">
                  <strong>Documente organizate</strong>
                  <span className="small muted">RCA · ITP · Rovinietă · CASCO</span>
                </div>
                <Check className="accent" size={18} />
              </div>
              <div className="list-row">
                <span className="list-icon">
                  <BellRing size={21} />
                </span>
                <div className="list-grow">
                  <strong>Scadențe sub control</strong>
                  <span className="small muted">Alerte configurate de tine</span>
                </div>
                <Check className="accent" size={18} />
              </div>
            </div>
          </div>
        </section>
        <section className="section" id="functii">
          <div className="section-head">
            <p className="eyebrow">SIMPLU, DE LA PRIMUL KILOMETRU</p>
            <h2>
              Ai grijă de drum.
              <br />
              Noi te ajutăm cu organizarea.
            </h2>
          </div>
          <div className="grid3">
            {[
              [
                Files,
                'Actele, la îndemână',
                'Documentele auto și termenele lor, într-un spațiu privat.',
              ],
              [
                BellRing,
                'Mementouri la timp',
                'Activează Web Push pe dispozitive compatibile. E-mailul necesită configurarea furnizorului.',
              ],
              [
                Wrench,
                'Istoric fără goluri',
                'Notează reviziile, piesele și kilometrajul, în ordine.',
              ],
              [
                ChartNoAxesCombined,
                'Vezi unde merg banii',
                'Urmărește costurile lunare și categoriile de cheltuieli.',
              ],
              [
                CarFront,
                'Tot garajul, împreună',
                'O mașină în planul gratuit. Mai multe, cu Premium.',
              ],
              [
                ShieldCheck,
                'Calendar și date private',
                'Vezi termenele în calendar. Acces privat și export conform planului.',
              ],
            ].map(([Icon, title, copy]) => (
              <article className="card feature" key={String(title)}>
                {typeof Icon !== 'string' && <Icon size={26} />}
                <h3>{String(title)}</h3>
                <p className="muted small">{String(copy)}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section seo-home-links">
          <h2>Organizează ce contează.</h2>
          <div className="grid3">
            {[
              [
                'documente-auto',
                'Documente și expirări',
                'Un dosar privat pentru RCA, ITP și celelalte acte.',
              ],
              ['intretinere-auto', 'Istoric de service', 'Revizii și reparații, în ordine.'],
              [
                'cheltuieli-auto',
                'Cheltuielile mașinii',
                'Înțelege costurile pe care le înregistrezi.',
              ],
            ].map(([slug, title, text]) => (
              <article className="card feature" key={slug}>
                <h3>
                  <Link href={'/' + slug}>{title} →</Link>
                </h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <p>
            <Link href="/preturi">Compară planurile Gratuit și Premium</Link> ·{' '}
            <Link href="/ghiduri">Citește ghidurile practice</Link>
          </p>
        </section>
        <section className="section">
          <div className="between">
            <div className="section-head">
              <p className="eyebrow">UN ÎNCEPUT FĂRĂ COMPLICAȚII</p>
              <h2>
                Mașina ta merită
                <br />
                un istoric bine păstrat.
              </h2>
              <p className="muted">Adaugi mașina. Completezi actele. Alegi când să fii anunțat.</p>
            </div>
            <Link href="/inregistrare" className="button primary">
              Deschide garajul <ArrowUpRight size={18} />
            </Link>
          </div>
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
              operatingSystem: 'Web',
              inLanguage: 'ro-RO',
              image: origin() + '/images/autocare-app-premium.webp',
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
              primaryImageOfPage: origin() + '/images/autocare-app-premium.webp',
            },
          ],
        }}
      />
    </PublicShell>
  );
}
