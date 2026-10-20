import Link from 'next/link';
import { origin } from '@/lib/config';
import { serializeJsonLd } from '@/lib/seo';
export function JsonLd({ value }: { value: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(value) }}
    />
  );
}
export function Breadcrumbs({ items }: { items: Array<{ name: string; path: string }> }) {
  const all = [{ name: 'Acasă', path: '/' }, ...items];
  return (
    <>
      <nav className="breadcrumbs" aria-label="Fir de navigare">
        {all.map((item, i) => (
          <span key={item.path}>
            {i > 0 && <span aria-hidden="true"> / </span>}
            {i === all.length - 1 ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <Link href={item.path}>{item.name}</Link>
            )}
          </span>
        ))}
      </nav>
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: new URL(item.path, origin()).toString(),
          })),
        }}
      />
    </>
  );
}
