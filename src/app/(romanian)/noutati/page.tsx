import { PublicShell } from '@/components/public-shell';
import { Breadcrumbs } from '@/components/seo-content';
import { PublicReleaseHistory } from '@/components/public-android-release';
import { publicMetadata } from '@/lib/seo';

const title = 'Noutăți AutoCare';
const intro = 'Vezi ce s-a schimbat în versiunile Android publicate de AutoCare, inclusiv actualizările SmartDrive GPS și instrucțiunile de instalare.';
export const metadata = publicMetadata('Noutăți AutoCare – Versiuni Android', intro, '/noutati');

export default function ReleasesPage() {
  return <PublicShell><main className="content-page seo-content ac-public-editorial ac-public-release">
    <Breadcrumbs items={[{ name: title, path: '/noutati' }]}/>
    <header className="ac-editorial-hero"><h1>{title}</h1><p>{intro}</p></header>
    <PublicReleaseHistory/>
  </main></PublicShell>;
}
