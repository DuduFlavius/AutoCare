import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'AutoCare Premium',
    short_name: process.env.NEXT_PUBLIC_APP_NAME || 'AutoCare',
    description: 'Garajul tău digital',
    id: '/cont',
    scope: '/',
    start_url: '/cont',
    orientation: 'any',
    categories: ['utilities', 'productivity'],
    display_override: ['standalone'],
    display: 'standalone',
    background_color: '#050E0B',
    theme_color: '#050E0B',
    lang: 'ro',
    shortcuts: [
      { name: 'Garaj', url: '/cont?tab=Garaj' },
      { name: 'SmartDrive GPS', url: '/cont?tab=SmartDrive%20GPS&drive=points' },
      { name: 'Notificări', url: '/cont?tab=Notific%C4%83ri' },
    ],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
