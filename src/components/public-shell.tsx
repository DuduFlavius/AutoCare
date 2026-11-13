import PublicAnalytics from './public-analytics';
import {ApplicationLanguageProvider} from './application-locale';
import { localizedPublicPath } from '@/lib/public-routes';
import { translateApplicationCopy } from '@/lib/application-language';
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
  language = 'ro',
}: {
  children: React.ReactNode;
  dark?: boolean;
  landing?: boolean;
  language?: 'ro'|'en';
}) {
  const t=(text:string)=>translateApplicationCopy(text,language);
  const href=(path:string)=>localizedPublicPath(path,language);
  const content = (
    <>
      <div className="wrap">
        <header className="public-nav">
          <Brand href={href('/')} label={language==='en'?'AutoCare · Home':'AutoCare · pagina principală'} />
          <nav className="navlinks" aria-label={language==='en'?'Main navigation':'Navigare principală'}>
            {landing && <Link href={href('/')} aria-current="page">{t('Acasă')}</Link>}
            <Link href={href('/functionalitati')}>{t('Funcționalități')}</Link>
            {!landing && <Link href={href('/cum-functioneaza')}>{t('Cum funcționează')}</Link>}
            <Link href={href('/preturi')}>{t('Prețuri')}</Link>
            <Link href={href('/ghiduri')}>{t('Ghiduri')}</Link>
            {landing && <Link href={href('/despre-noi')}>{t('Despre')}</Link>}
          </nav>
          <Link href={href('/autentificare')} className="button ghost">
            {t('Intră în cont')} <ArrowUpRight size={16} aria-hidden="true"/>
          </Link>
          {landing && <Link className="button ac-landing-nav-cta" href={href('/inregistrare')}>{t('Începe acum')}<ArrowUpRight size={15} aria-hidden="true" /></Link>}
          <PublicLanguage/><details className="ac-public-mobile-nav">
            <summary><Menu size={18}/>{t('Meniu')}</summary>
            <nav aria-label={language==='en'?'Mobile navigation':'Navigare mobilă'}>
              {landing && <Link href={href('/inregistrare')}>{t('Creează cont gratuit')}</Link>}
              <Link href={href('/functionalitati')}>{t('Funcționalități')}</Link>
              <Link href={href('/smart-gps')}>{t('SmartDrive GPS')}</Link>
              <Link href={href('/bluetooth')}>{t('Bluetooth')}</Link>
              <Link href={href('/autocare-maps')}>{t('AutoCare Maps')}</Link>
              <Link href={href('/smart-maintenance')}>{t('Smart Maintenance')}</Link>
              <Link href={href('/preturi')}>{t('Abonamente')}</Link>
              <Link href={href('/ghiduri')}>{t('Ghiduri')}</Link>
            </nav>
          </details>
        </header>
        {children}
        <section className="ac-install-banner" aria-label={language==='en'?'Install AutoCare on your phone':'Instalează AutoCare pe telefon'}>
          <div>
            <strong>{t('AutoCare, direct pe telefonul tău')}</strong>
            <p>{language==='en'?'Add the web app to your phone and access your garage faster.':'Adaugă aplicația web pe telefon și accesează-ți garajul mai rapid.'}</p>
          </div>
          <MobileInstall />
        </section>
        <PublicAnalytics/><footer className="footer">
          <div className="between">
            <span>
              © {new Date().getFullYear()} {appName}
            </span>
            <div className="footer-links">
              <Link href={href('/smart-gps')}>{t('Smart GPS')}</Link>
              <Link href={href('/bluetooth')}>{t('Bluetooth')}</Link>
              <Link href={href('/smart-maintenance')}>{t('Smart Maintenance')}</Link>
              <Link href={href('/autocare-maps')}>{t('AutoCare Maps')}</Link>
              <Link href={href('/garaj-digital')}>{language==='en'?'Digital garage':'Garaj digital'}</Link>
              <Link href={href('/itp-rca')}>{language==='en'?'Inspection and insurance':'ITP și RCA'}</Link>
              <Link href={href('/istoric-auto')}>{language==='en'?'Vehicle history':'Istoric auto'}</Link>
              <Link href={href('/mai-multe-vehicule')}>{language==='en'?'Multiple vehicles':'Mai multe vehicule'}</Link>
              <Link href={href('/administrarea-masinii')}>{language==='en'?'Car management':'Administrarea mașinii'}</Link>
              <Link href={href('/documente-auto')}>{t('Documente auto')}</Link>
              <Link href={href('/intretinere-auto')}>{t('Întreținere')}</Link>
              <Link href={href('/cheltuieli-auto')}>{t('Cheltuieli')}</Link>
              <Link href={href('/ghiduri')}>{t('Ghiduri')}</Link>
              <Link href={href('/despre-noi')}>{t('Despre noi')}</Link>
              <Link href={href('/contact')}>{t('Contact')}</Link>
              <Link href={href('/intrebari-frecvente')}>{t('Întrebări')}</Link>
              <Link href={href('/confidentialitate')}>{t('Confidențialitate')}</Link>
              <Link href={href('/termeni')}>{t('Termeni')}</Link>
              <Link href={href('/cookie-uri')}>{t('Cookie-uri')}</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
  return <div className={'ac-public-shell' + (dark ? ' ac-public-dark' : '')}><ApplicationLanguageProvider language={language}>{content}</ApplicationLanguageProvider></div>;
}
