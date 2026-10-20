import { PriceCards } from '@/components/membership';
import { pricing, DEFAULT_PRICING } from '@/lib/pricing';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/public-shell';
import { AuthForm } from '@/components/auth-form';
import { pages } from '@/lib/pages';
import { publicMetadata, publicTopics, seoTitles, indexableSlugs } from '@/lib/seo';
import { Breadcrumbs } from '@/components/seo-content';
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
      ? 'Compară planurile AutoCare: o mașină gratuit, Premium la 50 lei/lună sau 500 lei/an. Consultă condițiile abonamentelor și funcțiile incluse.'
      : 'Alege planul potrivit pentru garajul tău digital.');
  return {
    ...publicMetadata(title, description, '/' + slug),
    ...(!indexableSlugs.includes(slug)
      ? { robots: { index: false, follow: !authPages.includes(slug) } }
      : {}),
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (authPages.includes(slug))
    return (
      <PublicShell>
        <AuthForm mode={slug} />
      </PublicShell>
    );
  if (['preturi', 'comparatie'].includes(slug)) {
    const prices =
      process.env.DATABASE_URL || process.env.LOCAL_DATABASE_PATH
        ? await pricing()
        : DEFAULT_PRICING;
    return (
      <PublicShell>
        <main className="content-page">
          <Breadcrumbs
            items={[
              { name: slug === 'preturi' ? 'Prețuri' : 'Compară planurile', path: '/' + slug },
            ]}
          />
          <p className="eyebrow">AUTOCARE PREMIUM</p>
          <h1>
            Un garaj organizat.
            <br />
            Un plan pe măsură.
          </h1>
          <p>
            O mașină este inclusă în planul gratuit. Alege Premium pentru mai multe mașini, rapoarte
            și opțiuni avansate.
          </p>
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
  return (
    <PublicShell>
      <main className="content-page seo-content">
        <Breadcrumbs items={[{ name: p.title, path: '/' + slug }]} />
        <p className="eyebrow">AUTOCARE</p>
        <h1>{p.title}</h1>
        <p>{p.intro}</p>
        {topic && (
          <img
            className="seo-topic-image"
            src={topic.image}
            alt={topic.alt}
            width={960}
            height={420}
          />
        )}
        {p.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        {topic && (
          <p>
            <Link href="/ghiduri">Ghiduri practice pentru organizarea mașinii →</Link>
          </p>
        )}
        <Link href="/inregistrare" className="button primary">
          Creează cont gratuit ↗
        </Link>
      </main>
    </PublicShell>
  );
}
