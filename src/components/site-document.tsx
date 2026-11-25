import { startupImages } from '@/lib/pwa-launch';
import './filter-select.css';
import './document-controls.css';
import './premium-controls.css';
import {PremiumDialogHost} from './premium-dialogs';
import AutoUpdate from '@/components/auto-update';
import type { Metadata, Viewport } from 'next';
import '@/app/design-system.css';
import '@/app/globals.css';
import '@/app/premium.css';
import '@/app/autocare-ui.css';
import '@/app/reference-redesign.css';
import '@/app/premium-unified.css';
import '@/app/premium-dashboard.css';
import '@/app/mobile-app.css';
import '@/app/product-finish.css';
import '@/app/product-identity.css';
import '@/app/automotive-workspace.css';
import '@/app/ultra-cockpit.css';
import '@/app/product-system.css';
import { siteDescription } from '@/lib/seo';
import { appName, origin } from '@/lib/config';
export const metadata: Metadata = {
  metadataBase: new URL(origin()),
  title: { default: `${appName} — Mașina ta, fără griji`, template: `%s | ${appName}` },
  description: siteDescription,
  category: 'technology',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  ...(process.env.BING_SITE_VERIFICATION && /^[A-Fa-f0-9]{32}$/.test(process.env.BING_SITE_VERIFICATION) ? {other:{'msvalidate.01':process.env.BING_SITE_VERIFICATION}} : {}),
  applicationName: appName,
  appleWebApp: { capable: true, title: appName, statusBarStyle: 'black-translucent', startupImage: startupImages },
  icons: {
    icon: [
      { url: '/favicon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
  manifest: '/manifest.webmanifest',
  twitter: { card: 'summary_large_image', images: ['/opengraph-image'] },
  openGraph: {
    title: `${appName} — Mașina ta, fără griji`,
    description: siteDescription,
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
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F6F9FB' };
export default function SiteDocument({ children, language }: { children: React.ReactNode; language:'ro'|'en' }) {
  return (
    <html lang={language === 'ro' ? 'ro-RO' : 'en-GB'}>
      <body>{children}<PremiumDialogHost/><AutoUpdate /></body>
    </html>
  );
}
