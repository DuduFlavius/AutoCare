import type { MetadataRoute } from 'next';
import { origin } from '@/lib/config';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/cont$', '/cont?', '/cont/',
        '/admin',
        '/dosar',
        '/start',
        '/previzualizare',
        '/api/',
        '/autentificare',
        '/inregistrare',
        '/recuperare-parola',
        '/resetare-parola',
        '/en/sign-in', '/en/sign-up', '/en/forgot-password', '/en/reset-password',
      ],
    },
    sitemap: origin() + '/sitemap.xml',
  };
}
