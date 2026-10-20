import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { Breadcrumbs } from '@/components/seo-content';
import { guides } from '@/lib/guides';
import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata(
  'Ghiduri AutoCare – Documente, service și buget auto',
  'Ghiduri practice pentru organizarea documentelor mașinii, istoricului de service și cheltuielilor auto. Pași simpli, fără informații personale publicate.',
  '/ghiduri',
);
export default function Guides() {
  return (
    <PublicShell>
      <main className="content-page seo-content">
        <Breadcrumbs items={[{ name: 'Ghiduri', path: '/ghiduri' }]} />
        <p className="eyebrow">MAI PUȚINĂ DEZORDINE. MAI MULT CONTROL.</p>
        <h1>Un obicei bun pentru mașina ta.</h1>
        <p>
          Idei practice pentru un dosar auto organizat, un istoric de service coerent și cheltuieli
          mai ușor de înțeles.
        </p>
        <div className="seo-guide-grid">
          {Object.entries(guides).map(([slug, guide]) => (
            <article className="card" key={slug}>
              <p className="eyebrow">GHID PRACTIC</p>
              <h2>
                <Link href={'/ghiduri/' + slug}>{guide.title}</Link>
              </h2>
              <p>{guide.description}</p>
              <Link className="button ghost" href={'/ghiduri/' + slug}>
                Citește ghidul →
              </Link>
            </article>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
