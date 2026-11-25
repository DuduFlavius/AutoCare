import { PublicShell } from '@/components/public-shell';
import { Breadcrumbs } from '@/components/seo-content';
import { DownloadCenter } from '@/components/public-android-release';
import { publicMetadata } from '@/lib/seo';

const title = 'Descarcă AutoCare pentru Android';
const intro = 'Instalează aplicația oficială AutoCare pentru SmartDrive GPS, documente și revizii. Vezi versiunea actuală, cerințele și pașii de actualizare.';
export const metadata = publicMetadata(title, intro, '/descarca');

export default function AndroidDownloadPage() {
  return <PublicShell><main className="content-page seo-content ac-public-editorial ac-public-release">
    <Breadcrumbs items={[{ name: 'Descarcă Android', path: '/descarca' }]}/>
    <header className="ac-editorial-hero"><h1>{title}</h1><p>{intro}</p></header>
    <DownloadCenter/>
  </main></PublicShell>;
}
