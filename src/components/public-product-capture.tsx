import Image from 'next/image';

const captures: Record<string, { asset: string; ro: string; en: string; size?: [number, number] }> = {
  'smartdrive-gps': { asset: 'smartdrive', size: [390, 844], ro: 'SmartDrive GPS pe Android, cu manevra următoare și ora estimată de sosire', en: 'SmartDrive GPS on Android showing the next manoeuvre and estimated arrival' },
  'autocare-ai': { asset: 'ai', size: [1150, 605], ro: 'Conversație în AutoCare AI cu recomandări pentru o revizie', en: 'An AutoCare AI conversation with maintenance suggestions' },
  'garaj-digital': { asset: 'garage', ro: 'Tabloul de bord AutoCare cu documente, revizii și cheltuieli', en: 'AutoCare dashboard showing documents, maintenance and expenses' },
  'documente-auto': { asset: 'documents', ro: 'Dosarul de documente din AutoCare, cu datele de expirare ale actelor', en: 'AutoCare document workspace showing vehicle document expiry dates' },
  'intretinere-auto': { asset: 'maintenance', ro: 'Jurnalul de întreținere AutoCare cu o revizie înregistrată', en: 'AutoCare service history with a recorded maintenance entry' },
  'cheltuieli-auto': { asset: 'expenses', ro: 'Evidența cheltuielilor auto cu categorii și sume', en: 'Vehicle expense workspace showing categories and amounts' },
};

export default function PublicProductCapture({ slug, english = false }: { slug: string; english?: boolean }) {
  const capture = captures[slug];
  if (!capture) return null;
  const [width, height] = capture.size ?? (capture.asset === 'garage' ? [1180, 670] : [1080, 640]);
  const isNavigation = slug === 'smartdrive-gps';
  return <figure className={'ac-public-product-capture' + (isNavigation ? ' ac-public-navigation-capture' : '')}>
    <Image src={'/images/autocare-capture-' + capture.asset + '.webp'} width={width}
      height={height} unoptimized alt={english ? capture.en : capture.ro}/>
    <figcaption>{isNavigation
      ? <>{english ? 'SmartDrive screenshot during a simulated drive.' : 'Captură SmartDrive dintr-un traseu simulat.'} © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></>
      : english ? 'Screenshot of AutoCare with demonstration data.' : 'Captură din aplicația AutoCare, cu date demonstrative.'}</figcaption>
  </figure>;
}
