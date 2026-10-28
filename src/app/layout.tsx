import type { Metadata, Viewport } from 'next';
import './design-system.css';
import './globals.css';
import './premium.css';
import './autocare-ui.css';
import './reference-redesign.css';
import './premium-unified.css';
import './premium-dashboard.css';
import { siteDescription } from '@/lib/seo';
import { appName, origin } from '@/lib/config';
export const metadata: Metadata = {
  metadataBase: new URL(origin()),
  title: { default: `${appName} — Mașina ta, fără griji`, template: `%s | ${appName}` },
  description: siteDescription,
  keywords: ['AutoCare', 'aplicație întreținere auto', 'garaj digital', 'expirare RCA', 'expirare ITP', 'rovinietă', 'istoric service auto', 'revizie auto', 'cheltuieli auto', 'evidență mașină', 'documente auto', 'notificări auto'],
  category: 'technology',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  applicationName: appName,
  appleWebApp: { capable: true, title: appName, statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icon-192.png',
  },
  manifest: '/manifest.webmanifest',
  twitter: { card: 'summary_large_image', images: ['/opengraph-image'] },
  openGraph: {
    title: `${appName} — Mașina ta, fără griji`,
    description: 'Un loc pentru tot ce ține de mașina ta.',
    locale: 'ro_RO',
    type: 'website',
    siteName: appName,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AutoCare — Mașina ta. Totul sub control.',
      },
    ],
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#151B26' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
