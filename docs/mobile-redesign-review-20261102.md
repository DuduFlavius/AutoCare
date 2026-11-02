# AutoCare — redesign mobil, 2 noiembrie 2026

## Implementare

- Acasă: mașină selectată, kilometraj confirmat și actualizare directă, următoarea lucrare pe baza calculelor existente, documente urgente, adăugare rapidă, costuri și istoric. Rezumatele repetitive au fost înlocuite cu o singură ordine de priorități.
- Navigare: cinci destinații mobile (Acasă, Garaj, Intervenții, Documente, Cont). Desktop: meniu lateral grupat. Cont păstrează accesul la kilometraj, SmartDrive GPS, cheltuieli, calendar, istoric, notificări, suport, Premium, abonament și setări.
- Mașina selectată se păstrează în sesiunea browserului, separat pentru fiecare cont. Alegerea nu schimbă datele vehiculului.
- Garaj: selecție pentru Acasă, kilometraj direct, detalii tehnice opționale în formular, controale existente de editare, documente și arhivare păstrate.
- Documente și intervenții: carduri pe mobil, statistici compacte, filtre independente de căutare, formulare în doi pași și câmpuri specifice categoriei. Planificarea detaliată este accesibilă într-o secțiune extensibilă, fără rezumat duplicat.
- Cont, setări, Premium, abonament, calendar, notificări, cheltuieli, istoric și SmartDrive folosesc același sistem de suprafețe, controale, tipografie și spațiere.
- Componente separate pentru antet, navigare mobilă, Acasă, Cont și stări reutilizabile. Fișierul existent app-workspace.css a fost înlocuit, nu adăugat încă un strat separat de stiluri ale aplicației.
- Deconectarea din interfața principală verifică rezultatul real al autentificării. Anularea formularului mașinii respectă protecția modificărilor nesalvate și starea de salvare.
- PWA: manifest standalone păstrat, viewport cu safe areas, instalare cu instrucțiuni RO/EN pentru platformă, ecran offline static. Service worker-ul nu memorează pagini private sau API-uri; numai ecranul anonim offline este memorat.

## Verificări executate

- 157 teste automate trecute. Acoperă și salvări/recitiri, proprietatea datelor, calcule de întreținere, abonamente și securitatea Fondatorului din suita existentă.
- Test nou cu autentificare reală izolată: creare cont de test, login, dashboard autorizat, logout, dashboard respins cu vechiul cookie.
- Teste noi: alegere vehicul valid, refuzul vehiculelor arhivate/lipsă, calculul priorităților fără date inventate, continuitatea funcției gratuite pentru schimbul de ulei și excluderea prognozelor vechi de ulei/distribuție din Acasă când există o înregistrare mai nouă. Istoricul rămâne intact.
- Test nou pentru service worker: numai offline.html se memorează; cererile API nu sunt interceptate și nu sunt salvate în cache.
- Build Next.js și ESLint trecute.
- Browser Preview: navigare desktop prin intervenții, documente, kilometraj, calendar, cheltuieli, istoric, SmartDrive, abonament și Cont; selecție de vehicul și păstrare după reload; setări și schimbare RO/EN cu monedă EUR; deschidere formulare mașină/document; formular document în doi pași fără overflow la 320px; starea inițială fără mașini la 768px.
- Verificări vizuale la 320px, 390px și desktop; controalele și planificarea nu au fost înlocuite cu elemente decorative.

## Limite și continuitate

- Testele de salvare și autentificare sunt izolate, nu executate prin modificarea conturilor reale. Preview-ul afișează explicit date fictive și refuză salvarea.
- Nu s-au efectuat plăți reale, trimiteri de notificări/email către clienți, teste GPS în mișcare sau instalări pe iPhone/Android fizice. Acestea nu sunt declarate drept testate.
- Consola browserului a raportat mesaje ale extensiei de control Chrome; acestea au origine chrome-extension, nu aplicația AutoCare.
- API-urile, schema bazei de date, prețurile, variabilele de mediu și integrarea Stripe nu au fost modificate. Nu sunt necesare migrări pentru acest redesign.
- Pagina publică și autentificarea își păstrează designul existent; viewportFit a fost adăugat pentru zonele de siguranță PWA.
- Ramură: feature/autocare-mobile-redesign-20261102. Checkpoint local: checkpoint/pre-mobile-redesign-20261102.
