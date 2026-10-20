import Link from 'next/link';
import { appName } from '@/lib/config';
import { Brand } from './brand';
export { Brand } from './brand';
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="wrap">
        <header className="public-nav">
          <Brand />
          <nav className="navlinks" aria-label="Navigare principală">
            <Link href="/functionalitati">Funcționalități</Link>
            <Link href="/cum-functioneaza">Cum funcționează</Link>
            <Link href="/preturi">Prețuri</Link>
            <Link href="/ghiduri">Ghiduri</Link>
          </nav>
          <Link href="/autentificare" className="button ghost">
            Intră în cont ↗
          </Link>
        </header>
        {children}
        <footer className="footer">
          <div className="between">
            <span>
              © {new Date().getFullYear()} {appName}. Mai mult control. Mai puține griji.
            </span>
            <div className="footer-links">
              <Link href="/documente-auto">Documente auto</Link>
              <Link href="/intretinere-auto">Întreținere</Link>
              <Link href="/cheltuieli-auto">Cheltuieli</Link>
              <Link href="/ghiduri">Ghiduri</Link>
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
}
