import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'AutoCare Premium',
    short_name: process.env.NEXT_PUBLIC_APP_NAME || 'AutoCare',
    description: 'Garajul tău digital',
    start_url: '/cont',
    display: 'standalone',
    background_color: '#090d14',
    theme_color: '#111925',
    lang: 'ro',
    shortcuts: [
      { name: 'Garaj', url: '/cont?tab=Garaj' },
      { name: 'SmartDrive GPS', url: '/cont?tab=SmartDrive%20GPS&drive=points' },
      { name: 'Notificări', url: '/cont?tab=Notific%C4%83ri' },
    ],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
