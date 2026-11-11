import { origin } from '@/lib/config';
// Supplemental discovery file; public HTML and sitemap remain authoritative.
export function GET() {
  const base = origin();
  return new Response(`# AutoCare\n\n> Garaj digital în limba română pentru documente auto, întreținere, kilometraj și cheltuieli. Aplicație Android și web.\n\n## Surse publice\n${[
    ['Aplicația AutoCare', '/aplicatie-auto'],
    ['AutoCare AI și limitele Premium', '/autocare-ai'],
    ['Funcționalități', '/functionalitati'],
    ['Documente RCA, ITP și rovinietă', '/documente-auto'],
    ['Istoric service și lucrări planificate', '/intretinere-auto'],
    ['Cheltuieli și buget auto', '/cheltuieli-auto'],
    ['Prețuri și limite actuale', '/preturi'],
    ['Ghiduri', '/ghiduri'],
    ['Întrebări frecvente', '/intrebari-frecvente'],
  ].map(([label, path]) => `- [${label}](${base}${path})`).join('\n')}\n\n## Precizări\nDatele din garaj sunt private. AutoCare nu verifică documentele în registre oficiale. Distanțele GPS nu reprezintă citiri OBD ale odometrului. Prețurile și disponibilitatea curentă se verifică în paginile publice de mai sus.\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
