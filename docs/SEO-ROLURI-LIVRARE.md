# AutoCare — roluri, SEO și verificare

Data: 20 octombrie 2026. Domeniul real: https://autocare-garaj.vercel.app

## Gestionarea echipei

Intră în contul de Fondator, apoi „Panou Fondator · Roluri și Premium”. Panoul se deschide acum direct la „Roluri și permisiuni”. În „Adaugă în echipă”, introdu e-mailul unui cont existent și selectează Administrator sau Asistent. Confirmă acțiunea. Dacă persoana nu are cont, primești un mesaj explicit; aplicația nu îi creează o identitate sau o parolă fictivă și nu trimite invitații nesolicitate.

Pentru retragere, caută persoana, apasă „Gestionează”, apoi „Revocă accesul”. Contul revine la Client; datele lui nu sunt șterse. Schimbările sunt persistente și auditate. Rolul este verificat pe server la operațiunile de suport. Numai UID-ul de Fondator configurat în server poate acorda roluri; Administratorul și Asistentul nu pot promova alți utilizatori. Unicul Fondator nu poate fi retrogradat prin aceste operațiuni.

Premium manual rămâne în același detaliu de utilizator, cu perioadele 1/3/6/12 luni, dată personalizată și acces nelimitat ales explicit. Revocarea cere confirmare. Accesul manual rămâne separat de abonamentele plătite și nu creează venituri.

Pe telefon, lista utilizatorilor devine o listă de carduri, iar selectarea persoanei aduce în vedere acțiunile acesteia.

## SEO implementat

- Pagina principală: H1 și introducere despre organizarea mașinii, funcții reale, CTA de înregistrare, legături către modulele publice și ghiduri.
- Pagini publice noi: `/documente-auto`, `/intretinere-auto`, `/cheltuieli-auto`.
- Centru de informații: `/ghiduri` și trei ghiduri practice:
  - `/ghiduri/cum-urmaresti-expirarea-documentelor-auto`
  - `/ghiduri/cum-organizezi-istoricul-de-service`
  - `/ghiduri/cum-tii-evidenta-cheltuielilor-cu-masina`
- Conținutul public este randat pe server; ghidurile sunt generate static. Nu se publică date din conturi sau documente reale.
- Titluri și descrieri distincte, canonical absolut și metadata Open Graph/Twitter pe paginile publice relevante.
- Imagine originală de distribuire, compusă din identitatea AutoCare și fotografia existentă în proiect: https://autocare-garaj.vercel.app/opengraph-image (PNG, 1200×630).
- Fotografia principală este livrată în WebP de 1280 px (~47 KB) și 640 px (~17 KB), cu `srcset`, `sizes`, dimensiuni și prioritate mare de încărcare. Fotografia existentă în proiect este reutilizată; licența sursei originale nu a fost revalidată în această intervenție.
- Trei ilustrații SVG originale, publice, care descriu funcțiile fără date de utilizator. Alt-uri descriptive și dimensiuni explicite.
- Favicon SVG nou, iconuri PNG existente și icon Apple; manifestul aplicației este păstrat.
- JSON-LD: Organization, WebSite, SoftwareApplication și WebPage pe pagina principală, Article pe ghiduri și BreadcrumbList numai unde există breadcrumb vizibil.
- Nu sunt inventate ratinguri, recenzii, utilizatori, certificări sau magazine de aplicații. Planul gratuit are oferta reală de 0 RON. Prețurile Premium rămân 50 lei/lună și 500 lei/an în pagina de prețuri și API.
- Sitemap: https://autocare-garaj.vercel.app/sitemap.xml — 13 URL-uri publice și imagini relevante; generat din catalogul paginilor și ghidurilor. Datele de modificare sunt setate numai pentru articolele nou publicate, nu fabricate la fiecare acces.
- Robots: https://autocare-garaj.vercel.app/robots.txt — resursele și imaginile publice sunt accesibile; rutele de cont, administrare, API și autentificare sunt excluse.
- `noindex` pentru cont, administrare, autentificare și paginile juridice/contact încă în stadiu de proiect. Antet `X-Robots-Tag` pentru toate API-urile și rutele private. Robots nu înlocuiește autorizarea.
- Rutele inexistente răspund cu 404 real. Securitatea și redirecționarea canonică existente sunt păstrate.
- Navigarea publică rămâne vizibilă și derulabilă pe telefon. Ghidurile și formularele de echipă se așază pe o coloană.

Expresii vizate natural: aplicație pentru gestionarea mașinii, organizare documente auto, evidență RCA și ITP, expirare documente auto, istoric service auto, jurnal de întreținere, evidență revizii și reparații, evidență cheltuieli auto. Nu se promovează un calculator de costuri viitoare care nu există.

## Fișiere principale modificate

- `src/lib/founder.ts`, `src/app/api/v1/[...path]/route.ts`, `src/components/founder-panel.tsx`: acordare prin e-mail, revocare explicită, protecție și audit.
- `src/lib/seo.ts`, `src/lib/guides.ts`, `src/lib/pages.ts`: catalog public și conținut SEO.
- `src/app/page.tsx`, `src/app/[slug]/page.tsx`, `src/app/ghiduri/**`: pagini publice, metadate și navigare.
- `src/components/seo-content.tsx`: breadcrumb și serializare sigură JSON-LD.
- `src/app/layout.tsx`, `src/app/opengraph-image.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `next.config.ts`: metadata, imagine socială, indexare și antete.
- `src/components/public-shell.tsx`, `src/app/autocare-ui.css`: navigare și adaptare mobilă.
- `public/favicon.svg`, `public/images/**`: imagini și identitate publică.
- `tests/founder.test.ts`, `tests/seo.test.ts`: verificări de autorizare și SEO.

## Testare și limite

55 de teste automate trecute: includ roluri, interdicția escaladării, căutarea exactă prin e-mail, revocarea, auditul, Premium manual, notificările, chatul, datele private și SEO. Verificările TypeScript, lint și build sunt rulate înainte de publicare.

Verificare HTTP a celor 13 pagini publice: răspuns 200, un H1, canonical corect, metadata socială și JSON-LD parsabil. Sitemap XML valid, cu 13 URL-uri și imagini. Autentificarea și proiectele de pagini juridice au `noindex`; două rute inexistente au răspuns 404. Imaginea de distribuire a fost randată și inspectată vizual. API-urile private sunt verificate în producție separat; configurarea locală nu reproduce credențialele de producție.

Nu a fost efectuată o acordare de rol către o persoană reală, deoarece nu a fost indicat destinatarul. Nu s-au șters sau migrat date. Testele de rol folosesc o bază izolată.

Măsurătorile Core Web Vitals din teren nu pot fi confirmate imediat pentru noua versiune. Nu se declară un scor Lighthouse sau o validare Rich Results care nu a fost observată. Markup-ul SoftwareApplication fără recenzii/ratinguri reale poate să nu fie eligibil pentru rezultate speciale Google; nu se inventează date pentru a elimina acest avertisment.

Nu este disponibilă sesiunea Fondatorului în browserul de test. Fluxurile autentificate sunt verificate prin teste de integrare; primirea efectivă a bannerului push pe telefonul sau PC-ul proprietarului necesită activarea permisiunii pe dispozitiv. E-mailurile și plățile reale necesită în continuare configurarea furnizorilor; nu sunt simulate.

## Google Search Console — pașii proprietarului

1. Deschide https://search.google.com/search-console și adaugă o proprietate de tip **URL prefix**: `https://autocare-garaj.vercel.app/`. Pentru acest subdomeniu Vercel nu folosi o proprietate DNS pentru întregul `vercel.app`.
2. Alege metoda **HTML tag**. Copiază numai valoarea `content` a etichetei reale `google-site-verification` furnizate de Google.
3. În AutoCare, intră ca Fondator → Setări administrative → Google Search Console. Lipește codul sau întreaga etichetă HTML și apasă „Salvează verificarea Google”. Aplicația validează codul, îl salvează în baza de date, înregistrează acțiunea în audit și invalidează pagina principală și cache-ul de verificare. Nu este necesară o publicare manuală. Variabila server `GOOGLE_SITE_VERIFICATION` rămâne doar alternativă de configurare. Nu a fost inventat un cod și nu a fost modificat DNS-ul.
4. Revino în Search Console și apasă **Verify**. Păstrează eticheta de verificare.
5. La **Sitemaps**, trimite `https://autocare-garaj.vercel.app/sitemap.xml`.
6. La **URL inspection**, verifică pagina principală și paginile publice noi, rulează **Test live URL**, apoi **Request indexing** dacă sunt eligibile.
7. Verifică raportul **Page indexing** și performanța în tipul de căutare **Image**. Google decide dacă și când indexează paginile sau imaginile; implementarea tehnică nu garantează poziții sau rezultate speciale.
8. Pentru o verificare suplimentară, folosește https://search.google.com/test/rich-results pentru pagina principală și un ghid. Raportul poate include doar tipurile eligibile pentru rezultate speciale, nu toate tipurile Schema.org valide.

Surse oficiale consultate: https://developers.google.com/search/docs/appearance/google-images ; https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; https://developers.google.com/search/docs/appearance/structured-data/software-app ; https://support.google.com/webmasters/answer/9008080 .

## Rezultatul publicării și verificări live

Versiunea a fost publicată cu succes în proiectul Vercel `autocare-garaj`, deployment `dpl_3jihj5bgR8Mf7x9ncYdyo7wxjWj4`, stare READY, cu domeniul principal atribuit automat. Ultimele verificări automate: 55/55 teste, TypeScript, lint și build reușite.

Pe domeniul public au fost confirmate răspunsurile 200 și metadatele pentru pagina principală, cele trei pagini de module, centrul de ghiduri și un articol. Sitemap-ul live conține 13 URL-uri și imagini. API-urile Dashboard și Founder Overview returnează 401 fără sesiune; API-ul de prețuri returnează 5000 și 50000 bani în RON, cu economie de 10000 bani. Headerul API-ului de prețuri este `noindex, nofollow`. Pagina principală și pagina Documente au fost inspectate în browser pe desktop. Jurnalul browserului a arătat numai erori ale extensiei de automatizare, fără erori ale aplicației în verificarea respectivă.

A fost încercată validarea articolului despre istoricul de service în instrumentul oficial Google Rich Results Test. Serviciul a răspuns „Something went wrong — Log in and try again”. Prin urmare validarea externă Google nu este declarată trecută; proprietarul o poate relua din contul Google. Nu a fost întâlnită o provocare CAPTCHA interactivă și nu s-a încercat ocolirea autentificării.

Nu s-a efectuat un test fizic pe telefon și nu a fost accesată sesiunea privată a Fondatorului; aceste limite rămân distincte de testele de integrare și de modificările responsive implementate.


## Finisare vizuală și conectare simplificată la Search Console

Selectorul „Imaginea Dashboard-ului” a fost eliminat complet. Fotografia de prezentare este aleasă de aplicație, iar fotografiile personale din Garaj sunt păstrate. Documentele folosesc fișe compacte cu icon, mașina asociată, date lizibile, stare discretă și acțiunile existente. Filtrele și exporturile au fost mutate într-un panou pliabil; căutarea rămâne vizibilă. Panourile laterale repetitive au fost eliminate. La Întreținere, planificările apar numai când există înregistrări planificate, iar starea fără operațiuni are un singur CTA clar. Layoutul rămâne adaptabil pe mobil.

Setări administrative include formularul Search Console accesibil doar Fondatorului. Acceptă codul sau eticheta oficială Google, salvează numai tokenul validat și actualizează metadata paginii publice prin invalidarea cache-ului. Codurile de test sunt folosite exclusiv în baza izolată a testelor, niciodată în producție. Confirmarea proprietății nu poate fi finalizată până când proprietarul nu introduce codul real și nu apasă „Verifică” în Google.

Ultima suită: 57/57 teste trecute, inclusiv autorizarea și auditul codului Google, respingerea HTML-ului arbitrar și toate verificările anterioare. TypeScript, lint și build au trecut.

Finisarea a fost verificată vizual într-un preview izolat: selectorul fotografiei nu mai există, imaginea principală se încarcă, fișele documentelor sunt afișate pe două coloane pe desktop, iar filtrul RCA reduce rezultatele la documentul corect. Ultima versiune a fost publicată în producție: `dpl_CqGrMV27M3ogmF8RLF2yugVbAErY`, stare READY, domeniu principal `autocare-garaj.vercel.app`. Codul Google real nu a fost furnizat sau introdus în producție; proprietatea trebuie confirmată din contul Google după salvarea acestuia în noul formular.

## Premium vizibil în lista Fondatorului

Lista utilizatorilor include acum coloana Premium: activ sau fără Premium, sursa plătită/manuală sau ambele, data expirării și accesul fără expirare. Există filtre pentru Premium activ, fără Premium, manual și plătit. Starea se calculează pe server din abonamentele active cu ID de procesator și din acordările manuale nerevocate/neexpirate; înregistrările vechi fără ID de procesator nu sunt tratate ca plăți. Datele sunt returnate în format ISO pentru compatibilitate între browsere.

În detaliile utilizatorului există rezumatul accesului curent, acordare/prelungire și revocare manuală cu confirmare. Fila „Abonamente” afișează direct gestionarea Premium, fără formularul de roluri. Dacă rămâne activ un abonament plătit după revocarea accesului manual, statusul continuă să arate Premium plătit, corect. Nicio plată nu este anulată sau simulată prin aceste acțiuni.

58/58 teste trecute, inclusiv compararea statusului din lista Fondatorului cu autorizarea reală Premium, filtrele, expirările, accesul nelimitat, revocarea și cazul cu ambele surse. TypeScript, lint și build trecute. Nu sunt necesare migrații sau modificări asupra datelor existente.
