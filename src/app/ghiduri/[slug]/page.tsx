import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/public-shell';
import { Breadcrumbs, JsonLd } from '@/components/seo-content';
import { guides } from '@/lib/guides';
import { publicMetadata } from '@/lib/seo';
import { origin } from '@/lib/config';
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(guides).map((slug) => ({ slug }));
}
function guideFor(slug: string) {
  const guide = guides[slug as keyof typeof guides];
  if (!guide) notFound();
  return guide;
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideFor(slug);
  const metadata = publicMetadata(guide.title, guide.description, '/ghiduri/' + slug);
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      publishedTime: '2026-10-20T10:26:00+03:00',
      modifiedTime: '2026-10-20T10:26:00+03:00',
    },
  };
}
export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guideFor(slug);
  const url = origin() + '/ghiduri/' + slug;
  return (
    <PublicShell>
      <main className="content-page seo-content">
        <Breadcrumbs
          items={[
            { name: 'Ghiduri', path: '/ghiduri' },
            { name: guide.title, path: '/ghiduri/' + slug },
          ]}
        />
        <article>
          <p className="eyebrow">
            GHID AUTOCARE · <time dateTime="2026-10-20">20 octombrie 2026</time>
          </p>
          <h1>{guide.title}</h1>
          <p className="seo-intro">{guide.description}</p>
          {guide.sections.map(([title, text]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{text}</p>
            </section>
          ))}
          <aside className="card seo-next">
            <h2>Pune ordine, în ritmul tău.</h2>
            <p>Consultă funcțiile disponibile și începe cu informațiile pe care le ai deja.</p>
            <div className="actions">
              <Link href={'/' + guide.related} className="button ghost">
                Descoperă funcția
              </Link>
              <Link href="/inregistrare" className="button primary">
                Începe gratuit
              </Link>
            </div>
          </aside>
        </article>
        <section>
          <h2>Alte ghiduri utile</h2>
          {Object.entries(guides)
            .filter(([key]) => key !== slug)
            .map(([key, item]) => (
              <p key={key}>
                <Link href={'/ghiduri/' + key}>{item.title} →</Link>
              </p>
            ))}
        </section>
        <JsonLd
          value={{
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: guide.title,
            description: guide.description,
            mainEntityOfPage: url,
            url,
            inLanguage: 'ro-RO',
            datePublished: '2026-10-20T10:26:00+03:00',
            dateModified: '2026-10-20T10:26:00+03:00',
            author: { '@type': 'Organization', name: 'AutoCare', url: origin() },
            publisher: {
              '@type': 'Organization',
              name: 'AutoCare',
              url: origin(),
              logo: { '@type': 'ImageObject', url: origin() + '/icon-512.png' },
            },
          }}
        />
      </main>
    </PublicShell>
  );
}
