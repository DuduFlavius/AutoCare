# AutoCare — SEO, măsurare și distribuție

## Arhitectură și intenții

URL-ul RO rămâne stabil. Fiecare variantă EN are URL propriu și conținut HTML inițial EN; selectorul folosește aceleași perechi ca sitemap-ul și hreflang. Nu se redirecționează automat crawlerul după IP sau limba browserului. Autentificarea și spațiul privat nu se indexează.

| Intenție RO / EN | Pagină RO | Pagină EN |
|---|---|---|
| aplicație administrare mașină / car management app | /administrarea-masinii | /en/car-management |
| garaj digital / digital garage | /garaj-digital | /en/digital-garage |
| documente auto / vehicle document organizer | /documente-auto | /en/vehicle-documents |
| expirare ITP RCA / inspection insurance reminders | /itp-rca | /en/inspection-insurance-reminders |
| istoric auto personal / personal vehicle history | /istoric-auto | /en/vehicle-history |
| evidență cheltuieli / vehicle expense tracker | /cheltuieli-auto | /en/vehicle-expenses |
| istoric service / car service log | /intretinere-auto | /en/service-history |
| asistent auto AI / automotive AI assistant | /autocare-ai | /en/automotive-ai |
| mai multe vehicule / manage multiple vehicles | /mai-multe-vehicule | /en/multiple-vehicles |

Nu se promite verificare VIN oficială, citire OBD, asigurare sau sistem enterprise de dispecerat. Pentru căutări de flotă, prezentăm numai capacitățile existente de garaj cu mai multe vehicule. Nu se construiesc pagini repetitive pentru fiecare sinonim.

## Măsurare și acces extern necesar

- Search Console: verificarea existentă din Fondator sau GOOGLE_SITE_VERIFICATION; proprietate URL-prefix pentru domeniul de producție actual. Trimite /sitemap.xml și verifică paginile RO/EN în URL Inspection. Nu există în această sesiune acces la rapoarte sau dovadă că Google a indexat paginile.
- Bing Webmaster Tools: BING_SITE_VERIFICATION = tokenul real de 32 de caractere hexazecimale; verifică proprietatea și sitemap-ul în contul titularului.
- GA4: NEXT_PUBLIC_GA_MEASUREMENT_ID = identificatorul real G-... al fluxului web. Componenta publică nu încarcă scriptul înaintea acordului. Refuzul păstrează accesul. Nu se urmăresc conturile private, documentele, valorile formularelor sau parametrii URL. În proprietatea GA4 dezactivează Enhanced Measurement pentru formulare și colectarea datelor furnizate de utilizator. Validează în DebugView înainte de activare; integrarea nu este declarată activă fără identificator și verificare reală.
- Conversii implementate: sign_up/login emise după răspuns reușit al autentificării, când măsurarea este activă. support_request este un eveniment pregătit, neconectat încă la toate formularele. Nu se trimit evenimente de succes pentru acțiuni eșuate.
- Raport lunar: impresii/clicuri/CTR/poziție pe grupul de intenții și limbă, pagini indexate, trafic organic și conversii acceptate. Fără date din conturi, valorile rămân necunoscute, nu zero și nu estimate.
- Core Web Vitals: urmărește LCP/INP/CLS la percentila 75 pe mobil/desktop în CrUX/Search Console. Crawl-ul sintetic măsoară timpul HTTP total și octeții HTML, nu acești indicatori.

## Descoperire în motoare AI

robots.txt permite paginile publice crawlerelor generale. OAI-SearchBot este separat de GPTBot; nu este necesară deschiderea datelor private. llms.txt rămâne o listă suplimentară de surse publice, fără garanții de citare. Google precizează că nu necesită llms.txt sau schemă specială pentru AI. FAQ și Schema trebuie să corespundă conținutului vizibil, fără ratinguri sau recenzii inventate.

Surse oficiale consultate la 13.11.2026:
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- https://developers.openai.com/api/docs/bots

Nu se declară verificată o regulă specifică Perplexity/Gemini fără documentație și acces la rapoartele respective. Permisiunea generală de crawl nu echivalează cu includerea în răspunsuri.

## Autoritate: plan realist

1. Definitivează operatorul, canalul oficial de suport și politicile aprobate. Păstrează aceeași denumire și același domeniu în toate profilurile.
2. Creează profiluri sociale oficiale și pagini de produs reale; cere recenzii voluntare după utilizare, fără recompensă condiționată de rating.
3. Publică ghiduri practice cu capturi reale anonimizate și explicații despre limite. Actualizează când produsul se schimbă, fără date lastmod fictive.
4. Propune colaborări editoriale cu ateliere/publicații auto relevante; menționează sponsorizările și nu cumpăra backlinkuri spam.
5. Google Business Profile se creează numai dacă activitatea îndeplinește criteriile de eligibilitate; un SaaS exclusiv online nu primește automat un profil local.

## ASO — propuneri de texte, fără listare fictivă

Nume: AutoCare — Garaj digital / AutoCare — Digital Garage.
Descriere scurtă RO: Documente auto, revizii și cheltuieli, organizate în garajul tău digital.
Descriere scurtă EN: Vehicle documents, maintenance and expenses in your digital garage.
Subtitlu iOS propus: Documente, revizii și costuri / Documents, service & costs.
Categorie propusă: Auto & Vehicles în Google Play; verificare categorie utilitară relevantă în App Store.
Capturi necesare din build-ul final: Acasă fără fotografii auto, Documente cu date anonimizate, Istoric cheltuieli, Garaj, GPS/permisiuni reale. Mockup-urile nu se prezintă ca dovadă de testare.

## Blocaje înaintea magazinelor

- Android sursă: ro.autocare.garage, target/compile SDK 36. Cerința Google Play curentă: API 36 pentru aplicații și actualizări noi, din 31.08.2026. Configurarea nu dovedește un AAB conform.
- iOS: Xcode 26+ și SDK iOS 26+ pentru upload, conform cerințelor din 28.04.2026. Este necesar macOS/Xcode, echipă Apple și provisioning.
- Validare efectivă: release semnat, AAB/IPA, verificarea bibliotecilor native/16KB pe Android, permisiuni de locație și notificări, traseu în fundal cu ecran blocat, Bluetooth pe mașină reală, push APNs/Android, cameră, upload/download și recuperare conexiune.
- Abonamentele digitale din aplicații trebuie analizate conform politicilor de plată Google/Apple și programelor regionale aplicabile. Stripe web nu certifică automat conformitatea magazinelor. Nu se schimbă prețurile sau contractele existente în acest audit.
- Completează Data Safety/App Privacy, retenția, transferurile și destinatarii datelor AI/GPS după configurația reală. Cont de review și ștergere cont funcțională. Nu se declară formularele aprobate.

Surse: https://developer.android.com/google/play/requirements/target-sdk ; https://developer.apple.com/news/upcoming-requirements/?id=04282026a ; https://developer.apple.com/app-store/review/guidelines/ ; https://support.google.com/googleplay/android-developer/answer/10281818
