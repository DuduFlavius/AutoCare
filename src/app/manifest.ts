import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'AutoCare',
    short_name: process.env.NEXT_PUBLIC_APP_NAME || 'AutoCare',
    description: 'Garajul tău digital',
    start_url: '/cont',
    display: 'standalone',
    background_color: '#151B26',
    theme_color: '#151B26',
    lang: 'ro',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
