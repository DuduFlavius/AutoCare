import InstallGuide from '@/components/install-guide';
import { publicMetadata } from '@/lib/seo';

export const metadata = publicMetadata(
  'Instalează AutoCare pe Android și iPhone',
  'Adaugă garajul digital AutoCare pe ecranul principal al telefonului și accesează același cont de pe Android, iPhone și calculator.',
  '/instaleaza',
);

export default function InstallPage() {
  return <InstallGuide />;
}
