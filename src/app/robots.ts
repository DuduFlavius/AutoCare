import type { MetadataRoute } from 'next';
import { origin } from '@/lib/config';
/** Delimit private route names: /admin must never block /administrarea-masinii. */
export default function robots(): MetadataRoute.Robots {
 const privatePaths=['/cont','/admin','/dosar','/start','/previzualizare','/autentificare','/inregistrare','/recuperare-parola','/resetare-parola','/en/sign-in','/en/sign-up','/en/forgot-password','/en/reset-password'];
 return {rules:{userAgent:'*',allow:'/',disallow:[...privatePaths.flatMap(path=>[path+'$',path+'?',path+'/']),'/api/']},sitemap:origin()+'/sitemap.xml'};
}
