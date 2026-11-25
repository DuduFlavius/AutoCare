import { discoveryPages } from './discovery-pages';
import { publicLanguageAlternates } from './public-routes';
import { technologyPages } from './public-technology';
import type { Metadata } from 'next';
import { origin } from './config';
export const siteDescription =
  'AutoCare Premium: garaj digital pentru documente auto, ITP, RCA, revizii și cheltuieli. Istoricul mașinii tale, organizat pe telefon și desktop.';
export const homeTitle = 'AutoCare România – Aplicația ta pentru mașină';
export const homeDescription = 'Gestionează reviziile, documentele și cheltuielile mașinii. Descoperă SmartDrive GPS, garajul digital și asistentul AutoCare AI.';

export function brandGraph() {
  const site = new URL('/', origin()).href;
  const page = (path: string) => new URL(path, site).href;
  const id = (name: string) => site + '#' + name;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': id('organization'), name: 'AutoCare', alternateName: 'AutoCare România',
        url: site, logo: { '@type': 'ImageObject', url: page('/icon-512.png'), width: 512, height: 512 } },
      { '@type': 'WebSite', '@id': id('website'), name: 'AutoCare România', alternateName: 'AutoCare',
        url: site, inLanguage: 'ro-RO', publisher: { '@id': id('organization') } },
      { '@type': 'SoftwareApplication', '@id': id('application'), name: 'AutoCare', alternateName: 'AutoCare România',
        url: page('/aplicatie-auto'), description: homeDescription, applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Android, Web', inLanguage: ['ro-RO', 'en-GB'], image: page('/opengraph-image'),
        screenshot: page('/images/autocare-capture-garage.webp'), installUrl: page('/descarca'),
        publisher: { '@id': id('organization') }, featureList: ['Garaj digital', 'Documente RCA, ITP și rovinietă',
          'Istoric service și revizii', 'Cheltuieli auto', 'SmartDrive GPS pe Android', 'AutoCare AI'],
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'RON', url: page('/preturi'), description: 'Plan gratuit pentru o mașină activă' } },
      { '@type': 'WebPage', '@id': id('webpage'), url: site, name: homeTitle, description: homeDescription,
        inLanguage: 'ro-RO', isPartOf: { '@id': id('website') }, about: { '@id': id('application') },
        primaryImageOfPage: { '@type': 'ImageObject', url: page('/opengraph-image'), width: 1200, height: 630 } },
    ],
  };
}

export const publicTopics = {
  'documente-auto': {
    title: 'Organizează documentele auto și urmărește expirarea',
    intro:
      'RCA, ITP, rovinietă și CASCO, într-un dosar digital pentru fiecare mașină. AutoCare te ajută să vezi datele introduse de tine și documentele care necesită atenție.',
    image: '/images/organizare-documente-auto.svg',
    alt: 'Schemă AutoCare cu documente organizate și etapele de urmărire a termenelor',
    sections: [
      [
        'Un document, la mașina potrivită',
        'Alegi mașina și tipul documentului, apoi completezi data expirării. Data emiterii, seria și notițele sunt opționale. Poți păstra o fotografie sau un PDF, în limitele planului, fără să publici documentul pe internet.',
      ],
      [
        'Înțelege imediat ce necesită atenție',
        'Documentele sunt grupate după starea calculată din data expirării: în termen, expiră în următoarele 30 de zile, expirate sau cu date incomplete. Arhiva păstrează separat documentele pe care nu le mai urmărești ca active.',
      ],
      [
        'Mementouri alese de tine',
        'Configurează fusul orar și intervalele disponibile în planul tău. Pentru bannere pe dispozitiv, activează Web Push și acceptă permisiunea browserului. Pe iPhone, deschide aplicația adăugată pe ecranul principal. E-mailul este un canal separat, disponibil după conectarea furnizorului și confirmarea adresei.',
      ],
      [
        'Regăsește actele fără să răsfoiești dosare',
        'Caută după nume sau categorie și filtrează după mașină ori stare. Poți modifica datele și consulta istoricul. Exporturile CSV și PDF sunt disponibile conform abonamentului. AutoCare nu verifică valabilitatea documentelor în registre oficiale; verifică întotdeauna datele din actul original.',
      ],
    ],
  },
  'intretinere-auto': {
    title: 'Istoric service și întreținere auto',
    intro:
      'Construiește un jurnal de întreținere auto cu revizii, reparații, kilometraj și costuri. Înregistrările rămân asociate mașinii tale, într-un istoric ușor de consultat.',
    image: '/images/istoric-intretinere-auto.svg',
    alt: 'Schemă a jurnalului AutoCare: operațiune, kilometraj și istoric de service',
    sections: [
      [
        'Înregistrează rapid o intervenție',
        'Selectează mașina, tipul lucrării și data. Dacă există o singură mașină, este selectată automat. Costul și kilometrajul pot rămâne necompletate atunci când nu sunt cunoscute; o sumă necunoscută nu înseamnă o operațiune gratuită.',
      ],
      [
        'Păstrează detaliile când ai nevoie de ele',
        'Secțiunea de detalii suplimentare include atelierul, descrierea, piesele, numărul facturii și notițele. Încarcă o fotografie sau o factură în formatele acceptate și limitele planului. Informațiile și atașamentele sunt private.',
      ],
      [
        'Consultă istoricul în ordine',
        'Cronologia prezintă lucrările de la cele mai recente la cele mai vechi. Folosește căutarea și filtrele pentru a găsi schimburile de ulei, filtre, frâne, anvelope sau alte categorii. Editează o înregistrare existentă pentru o corecție, fără să creezi un duplicat.',
      ],
      [
        'Planifică pe baza informațiilor corecte',
        'Planifică o lucrare în Calendar și înregistrează separat data și kilometrajul la care a fost efectuată. În ultima săptămână, programarea poate apărea și în rezumatul contului. Pentru reviziile recurente, introdu termenul sau pragul de kilometraj confirmat. Pentru recomandările tehnice urmează documentația producătorului și indicațiile unui atelier calificat.',
      ],
    ],
  },
  'cheltuieli-auto': {
    title: 'Evidența cheltuielilor auto',
    intro:
      'Vezi cât ai cheltuit cu mașina folosind costurile pe care le înregistrezi. Organizează sumele în RON, categoriile și istoricul pentru o imagine mai clară a bugetului auto.',
    image: '/images/evidenta-cheltuieli-auto.svg',
    alt: 'Schemă AutoCare pentru organizarea costurilor după categorie, perioadă și mașină',
    sections: [
      [
        'Începe cu o înregistrare simplă',
        'Alege mașina, categoria, data și suma. Poți nota furnizorul și explicația cheltuielii, pentru a o recunoaște ulterior. Folosește datele și sumele din bonuri sau facturi, nu estimări prezentate ca plăți reale.',
      ],
      [
        'Compară perioadele în același mod',
        'Compară cheltuielile lunare și anuale pe vehicul și categorie. Graficul diferențiază o perioadă fără înregistrări de o perioadă cu un cost înregistrat de zero lei. În Premium poți stabili un buget lunar pe vehicul și urmări cât ai consumat din el.',
      ],
      [
        'Evită dublarea costurilor',
        'O intervenție poate avea propriul cost în jurnalul de întreținere. Înainte să adaugi încă o cheltuială pentru aceeași factură, verifică înregistrările existente și ce include raportul consultat. Corectează înregistrarea originală când ai introdus o sumă greșită.',
      ],
      [
        'Un obicei mic, un istoric util',
        'Actualizează evidența după o revizie sau o cheltuială importantă și păstrează o descriere consecventă. Rapoartele reflectă numai datele înregistrate; AutoCare nu accesează automat conturi bancare și nu este un calculator al costului viitor al mașinii.',
      ],
    ],
  },
} as const;
export const seoTitles: Record<string, string> = {
  functionalitati: 'Funcții AutoCare – Documente, Revizii și Cheltuieli Auto',
  'cum-functioneaza': 'Cum funcționează AutoCare – Garajul tău digital',
  'documente-auto': 'Organizează Documentele Auto și Urmărește Expirarea',
  'intretinere-auto': 'Istoric Service și Întreținere Auto',
  'cheltuieli-auto': 'Evidența cheltuielilor auto',
  'descarca': 'Descarcă AutoCare pentru Android',
  'noutati': 'Noutăți AutoCare',
  preturi: 'Prețuri AutoCare – Planuri Gratuit și Premium',
  comparatie: 'Gratuit sau Premium – Compară planurile AutoCare',
  'intrebari-frecvente': 'Întrebări frecvente despre AutoCare',
};
export const indexableSlugs = [
  ...Object.keys(discoveryPages),
  'despre-noi',
  'aplicatie-auto',
  'instaleaza',
  'descarca',
  'noutati',
  'functionalitati',
  'cum-functioneaza',
  ...Object.keys(publicTopics),
  ...Object.keys(technologyPages).filter(slug=>slug!=='smart-gps'),
  'smartdrive-gps',
  'contact',
  'preturi',
  'autocare-ai',
  'intrebari-frecvente',
];
export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path, origin()).toString();
  const english=path==='/en'||path.startsWith('/en/');
  const imagePath=english?'/en/opengraph-image':'/opengraph-image';
  const displayTitle = /\bAutoCare\b/i.test(title) ? title : title + ' | AutoCare';
  return {
    title: { absolute: displayTitle },
    description,
    alternates: { canonical: url, languages: publicLanguageAlternates(path, origin()) },
    openGraph: {
      title: displayTitle,
      description,
      url,
      siteName: 'AutoCare România',
      alternateLocale: [english ? 'ro_RO' : 'en_GB'],
      locale: english?'en_GB':'ro_RO',
      type: 'website',
      images: [
        {
          url: new URL(imagePath, origin()).toString(),
          width: 1200,
          height: 630,
          alt: english?'AutoCare Premium — your digital garage, documents and maintenance.':'AutoCare Premium — garajul tău digital, documente și întreținere.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
      description,
      images: [new URL(imagePath, origin()).toString()],
    },
  };
}
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
