import Image from 'next/image';
import Link from 'next/link';
import { Download, ShieldCheck, Smartphone } from 'lucide-react';
import { formatReleaseDate, readAndroidRelease } from '@/lib/android-release';
import '@/app/public-android.css';

type Props = { english?: boolean };

export function DownloadCenter({ english = false }: Props) {
  const release = readAndroidRelease();
  const locale = english ? 'en-GB' : 'ro-RO';
  const date = formatReleaseDate(release?.publishedAt, locale);
  return <>
    <div className="ac-release-overview">
    <section className="ac-release-card" aria-labelledby="android-release-title">
      <div className="ac-release-card-title">
        <span className="ac-release-icon"><Smartphone size={24} aria-hidden="true"/></span>
        <div><h2 id="android-release-title">{release ? 'AutoCare ' + release.version : 'AutoCare pentru Android'}</h2>
          {date && <p>{english ? 'Published ' : 'Publicată pe '}{date}</p>}</div>
      </div>
      {release ? <>
        <dl className="ac-release-facts">
          <div><dt>{english ? 'APK size' : 'Dimensiune APK'}</dt><dd>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(release.bytes / 1_000_000)} MB</dd></div>
          {release.minSdk && <div><dt>{english ? 'Requirements' : 'Cerințe'}</dt><dd>{release.minSdk === 24 ? 'Android 7.0+' : 'Android API ' + release.minSdk + '+'}</dd></div>}
        </dl>
        <a className="ac-release-button" href={release.url} download><Download size={18} aria-hidden="true"/>{english ? 'Download the official APK' : 'Descarcă APK-ul oficial'}</a>
        <p className="ac-release-signing"><ShieldCheck size={17} aria-hidden="true"/>{english ? 'Official signed installer. Android verifies the signing certificate during updates.' : 'Instalator oficial semnat. Android verifică certificatul la actualizare.'}</p>
      </> : <p role="status">{english ? 'The installer is currently unavailable. Try again later.' : 'Instalatorul este indisponibil momentan. Încearcă din nou mai târziu.'}</p>}
    </section>
    <figure className="ac-release-preview">
      <Image alt={english ? 'AutoCare on a phone, showing the vehicle and shortcuts' : 'AutoCare pe telefon, cu vehiculul și acces rapid la documente și revizii'} src="/images/autocare-capture-mobile.webp" width={390} height={800} unoptimized/>
      <figcaption>{english ? 'App screenshot with demo data.' : 'Captură din aplicație, cu date demonstrative.'}</figcaption>
    </figure>
    </div>
    <section className="ac-release-instructions">
      <div><h2>{english ? 'Install AutoCare' : 'Instalează AutoCare'}</h2><ol>
        <li>{english ? 'Download the official APK from this page.' : 'Descarcă APK-ul oficial de pe această pagină.'}</li>
        <li>{english ? 'Open the downloaded file. If prompted, allow your browser to install this APK.' : 'Deschide fișierul descărcat. Dacă Android cere permisiune, permite browserului să instaleze acest APK.'}</li>
        <li>{english ? 'Confirm installation and sign in with your AutoCare account.' : 'Confirmă instalarea și intră în contul AutoCare.'}</li>
      </ol></div>
      <div><h2>{english ? 'Update from AutoCare' : 'Actualizează din aplicație'}</h2><ol>
        <li>{english ? 'Save any active GPS trip.' : 'Salvează traseul GPS dacă ai o sesiune activă.'}</li>
        <li>{english ? 'Go to Settings → App & display → Check Android update.' : 'Intră la Setări → Aplicație și afișare → Verifică actualizarea Android.'}</li>
        <li>{english ? 'Download the new version and confirm the Android installation.' : 'Descarcă versiunea nouă și confirmă instalarea în Android.'}</li>
      </ol></div>
    </section>
    {release?.changes && <section><h2>{english ? 'What’s new' : 'Ce aduce versiunea actuală'}</h2><ul>
      {release.changes[english ? 'en' : 'ro'].map(change => <li key={change}>{change}</li>)}
    </ul><Link href={english ? '/en/releases' : '/noutati'}>{english ? 'View release history' : 'Vezi istoricul versiunilor'} →</Link></section>}
    <p><Link href={english ? '/en/install' : '/instaleaza'}>{english ? 'Install the web app on your home screen' : 'Adaugă aplicația web pe ecranul principal'}</Link></p>
  </>;
}

export function PublicReleaseHistory({ english = false }: Props) {
  const release = readAndroidRelease();
  const notes = release ? [release, ...(release.previous ?? [])] : [];
  return <>
    <div className="ac-release-timeline">
      {notes.map(note => {
        const date = formatReleaseDate(note.publishedAt, english ? 'en-GB' : 'ro-RO');
        return <article className="ac-release-card" key={note.version}>
          <h2>Android {note.version}</h2>{date && <p>{date}</p>}
          {!!note.changes && <ul>{note.changes[english ? 'en' : 'ro'].map(change => <li key={change}>{change}</li>)}</ul>}
        </article>;
      })}
    </div>
    <Link className="ac-release-button" href={english ? '/en/download' : '/descarca'}><Download size={18} aria-hidden="true"/>{english ? 'Download AutoCare for Android' : 'Descarcă AutoCare pentru Android'}</Link>
  </>;
}
