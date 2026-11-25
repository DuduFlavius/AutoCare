import { publicLanguageAlternates, publicRoutePairs } from '@/lib/public-routes';
import type { MetadataRoute } from 'next';
import { origin } from '@/lib/config';
import { indexableSlugs } from '@/lib/seo';
import { guides } from '@/lib/guides';
const productImages: Record<string, string> = {
  'garaj-digital': 'garage',
  'documente-auto': 'documents',
  'intretinere-auto': 'maintenance',
  'cheltuieli-auto': 'expenses',
  'smartdrive-gps': 'smartdrive',
  'autocare-ai': 'ai',
  'descarca': 'mobile',
};
export default function sitemap(): MetadataRoute.Sitemap {
  const entries = [
    '',
    'stergere-cont',
    'rca-rovinieta',
    ...indexableSlugs.filter(slug=>slug!=='smart-gps'),
    'ghiduri',
    ...Object.keys(guides).map((slug) => 'ghiduri/' + slug),
  ].map((path) => ({
    url: new URL('/' + path, origin()).toString(),
    alternates: { languages: publicLanguageAlternates('/' + path, origin()) ?? {} },
    ...(path.startsWith('ghiduri/') ? { lastModified: '2026-10-20T07:26:00.000Z' } : {}),
    ...(path === '' ? { images: [origin() + '/icon-512.png',origin() + '/images/autocare-capture-garage.webp',origin() + '/opengraph-image'] } : {}),
    ...(productImages[path] ? { images: [origin() + '/images/autocare-capture-' + productImages[path] + '.webp'] } : {}),
  }));
  return entries.flatMap(entry => {
    const path=new URL(entry.url).pathname;
    return publicRoutePairs[path] ? [entry,{url:new URL(publicRoutePairs[path],origin()).href,alternates:entry.alternates}] : [entry];
  });
}
