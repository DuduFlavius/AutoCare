import { PublicAiIntro } from '@/components/public-ai-intro';
import { technologyPages } from '@/lib/public-technology';
import { TechnologyNavigation } from '@/components/technology-navigation';
import { ArrowUpRight } from 'lucide-react';
import { PriceCards } from '@/components/membership';
import { pricing, DEFAULT_PRICING } from '@/lib/pricing';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/public-shell';
import { AuthForm } from '@/components/auth-form';
import { pages } from '@/lib/pages';
import { publicMetadata, publicTopics, seoTitles, indexableSlugs } from '@/lib/seo';
import { Breadcrumbs, JsonLd } from '@/components/seo-content';
import { origin } from '@/lib/config';
const authPages = ['autentificare', 'inregistrare', 'recuperare-parola', 'resetare-parola'];
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title =
    seoTitles[slug] ||
    pages[slug]?.title ||
    (
      {
        preturi: 'Prețuri',
        comparatie: 'Gratuit versus Premium',
        autentificare: 'Autentificare',
        inregistrare: 'Creare cont',
        'recuperare-parola': 'Recuperare parolă',
        'resetare-parola': 'Resetare parolă',
      } as Record<string, string>
    )[slug] ||
    'AutoCare';
  const description =
    pages[slug]?.intro ||
    (slug === 'preturi'
      ? 'Compară planurile AutoCare. Vezi funcțiile incluse în planul gratuit și prețurile actuale pentru abonamentele Premium.'
      : 'Alege planul potrivit pentru garajul tău digital.');
  return {
    ...publicMetadata(title, description, '/' + slug),
    ...(!indexableSlugs.includes(slug)
      ? { robots: { index: false, follow: !authPages.includes(slug) } }
      : {}),
  };
}
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  if (authPages.includes(slug)) {
    const { next } = await searchParams;
    return (
      <PublicShell>
        <AuthForm mode={slug} next={typeof next === 'string' && next.startsWith('/cont?') ? next : '/cont'} />
      </PublicShell>
    );
  }
  if (['preturi', 'comparatie'].includes(slug)) {
    const prices =
      process.env.DATABASE_URL || process.env.LOCAL_DATABASE_PATH
        ? await pricing()
        : DEFAULT_PRICING;
    return (
      <PublicShell dark>
        <main className="content-page ac-public-editorial">
          <Breadcrumbs
            items={[
              { name: slug === 'preturi' ? 'Prețuri' : 'Compară planurile', path: '/' + slug },
            ]}
          />
          <header className="ac-editorial-hero">
          <p className="eyebrow">AUTOCARE PREMIUM</p>
          <h1>Abonamente AutoCare</h1>
          <p>
            O mașină este inclusă în planul gratuit. Alege Premium pentru mai multe mașini, rapoarte
            și opțiuni avansate.
          </p>
          </header>
          <PublicAiIntro />
          <PriceCards monthlyBani={prices.monthlyBani} annualBani={prices.annualBani} />
          <p className="small muted">
            Tarife în RON. Abonamente recurente, administrate în portalul de facturare. Checkout-ul
            este disponibil numai după configurarea și verificarea procesatorului.
          </p>
        </main>
      </PublicShell>
    );
  }
  const topic = publicTopics[slug as keyof typeof publicTopics];
  const p = pages[slug];
  if (!p) notFound();
  const technology = technologyPages[slug as keyof typeof technologyPages];
  const faq = slug === 'intrebari-frecvente';
  const legal = ['confidentialitate', 'termeni', 'cookie-uri'].includes(slug);
  const cta = technology
    ? { href: technology.workspace, label: technology.action }
    : slug === 'autocare-ai'
      ? { href: '/inregistrare?next=%2Fcont%3Ftab%3DAutoCare%2BAI', label: 'Descoperă AI în Premium' }
    : slug === 'contact'
      ? { href: '/cont?tab=Centru%20de%20suport', label: 'Deschide Centrul de suport' }
      : { href: '/inregistrare', label: 'Creează cont gratuit' };
  return (
    <PublicShell dark>
      <main className="content-page seo-content ac-public-editorial" data-legal={legal || undefined}>
        <Breadcrumbs items={[{ name: technology?.label || p.title, path: '/' + slug }]} />
        <header className="ac-editorial-hero">
          <p className="eyebrow">{technology?.label || 'AUTOCARE PREMIUM'}</p>
          <h1>{p.title}</h1>
          <p>{p.intro}</p>
          {!legal && <Link href={cta.href} className="button primary">{cta.label} <ArrowUpRight size={17}/></Link>}
        </header>
        {topic && <img className="seo-topic-image" src={topic.image} alt={topic.alt} width={960} height={420} loading="lazy" />}
        {['functionalitati', 'autocare-ai'].includes(slug) && <PublicAiIntro />}
        {(slug === 'functionalitati' || technology) && <TechnologyNavigation current={slug}/>}
        {faq ? (
          <div className="public-faq">
            {p.sections.map(([title, text]) => (
              <details key={title}><summary>{title}</summary><p>{text}</p></details>
            ))}
          </div>
        ) : (
          <div className="ac-editorial-sections">
            {p.sections.map(([title, text], index) => (
              <section key={title}>
                {!legal && <span aria-hidden="true" className="ac-editorial-index">{String(index + 1).padStart(2, '0')}</span>}
                <h2>{title}</h2><p>{text}</p>
              </section>
            ))}
          </div>
        )}
        {topic && <Link href="/ghiduri">Ghiduri practice pentru organizarea mașinii →</Link>}
        {(faq || technology) && <JsonLd value={faq ? {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: p.sections.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })),
        } : {
          '@context': 'https://schema.org', '@type': 'WebPage', name: p.title,
          description: p.intro, inLanguage: 'ro-RO', url: new URL('/' + slug, origin()).href,
        }}/>}
      </main>
    </PublicShell>
  );
}
