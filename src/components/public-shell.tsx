import Link from 'next/link';
import { ArrowUpRight, Menu } from 'lucide-react';
import { appName } from '@/lib/config';
import { Brand } from './brand';
import MobileInstall from './mobile-install';
import PublicLanguage from './public-language';
import './public-surfaces.css';
export { Brand } from './brand';
export function PublicShell({
  children,
  dark = false,
  landing = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
  landing?: boolean;
}) {
  const content = (
    <>
      <div className="wrap">
        <header className="public-nav">
          <Brand href={landing ? "/" : undefined} />
          <nav className="navlinks" aria-label="Navigare principală">
            {landing && <Link href="/" aria-current="page">Acasă</Link>}
            <Link href="/functionalitati">Funcționalități</Link>
            {!landing && <Link href="/cum-functioneaza">Cum funcționează</Link>}
            <Link href="/preturi">Prețuri</Link>
            <Link href="/ghiduri">Ghiduri</Link>
            {landing && <Link href="/despre-noi">Despre</Link>}
          </nav>
          <Link href="/autentificare" className="button ghost">
            Intră în cont <ArrowUpRight size={16} aria-hidden="true"/>
          </Link>
          {landing && <Link className="button ac-landing-nav-cta" href="/inregistrare">Începe acum <ArrowUpRight size={15} aria-hidden="true" /></Link>}
          <PublicLanguage/><details className="ac-public-mobile-nav">
            <summary><Menu size={18}/> Meniu</summary>
            <nav aria-label="Navigare mobilă">
              {landing && <Link href="/inregistrare">Creează cont gratuit</Link>}
              <Link href="/functionalitati">Funcționalități</Link>
              <Link href="/smart-gps">SmartDrive GPS</Link>
              <Link href="/bluetooth">Bluetooth</Link>
              <Link href="/autocare-maps">AutoCare Maps</Link>
              <Link href="/smart-maintenance">Smart Maintenance</Link>
              <Link href="/preturi">Abonamente</Link>
              <Link href="/ghiduri">Ghiduri</Link>
            </nav>
          </details>
        </header>
        {children}
        <section className="ac-install-banner" aria-label="Instalează AutoCare pe telefon">
          <div>
            <strong>AutoCare, direct pe telefonul tău</strong>
            <p>Instalează aplicația pe iPhone sau Samsung și accesează-ți garajul mai rapid.</p>
          </div>
          <MobileInstall />
        </section>
        <footer className="footer">
          <div className="between">
            <span>
              © {new Date().getFullYear()} {appName}
            </span>
            <div className="footer-links">
              <Link href="/smart-gps">Smart GPS</Link>
              <Link href="/bluetooth">Bluetooth</Link>
              <Link href="/smart-maintenance">Smart Maintenance</Link>
              <Link href="/autocare-maps">AutoCare Maps</Link>
              <Link href="/documente-auto">Documente auto</Link>
              <Link href="/intretinere-auto">Întreținere</Link>
              <Link href="/cheltuieli-auto">Cheltuieli</Link>
              <Link href="/ghiduri">Ghiduri</Link>
              <Link href="/despre-noi">Despre noi</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/intrebari-frecvente">Întrebări</Link>
              <Link href="/confidentialitate">Confidențialitate</Link>
              <Link href="/termeni">Termeni</Link>
              <Link href="/cookie-uri">Cookie-uri</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
  return <div className={'ac-public-shell' + (dark ? ' ac-public-dark' : '')}>{content}</div>;
}
