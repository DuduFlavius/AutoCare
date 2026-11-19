# Racing Green 9.0 — implementare și verificare

Data: 19 noiembrie 2026. Bază: Racing Green 8.0, commit publicat d5412bde90fe8694091456ab4b9b9093743a5a72. Backup local înaintea modificărilor: backup/pre-racing-green-9-20261119.

## Modificări

- Sidebar refăcut: zece destinații principale constante, instrumentele secundare într-un grup extensibil; drepturile și legăturile administrative păstrate. Premium și profil sunt compacte; RO/EN rămâne vizibil în antet. Eliminat blocul mare Premium și selectorul duplicat din subsol.
- Antet desktop cu căutare, contextul paginii, notificări, abonament, RO/EN și profil; antetul mobil și safe-area păstrate.
- Acasă: vehicul și intervenție alăturate pe desktop, patru scurtături, trei indicatori reali, cheltuieli recente. Pe mobil aceeași informație organizată vertical. Simbol auto neutru, fără fotografii.
- Documente: tabel semantic pe desktop, carduri pe mobil; filtre, previzualizare, descărcare, editare, ștergere cu confirmarea existentă, istoric, arhivare/restaurare și atașare păstrate.
- Întreținere: trei indicatori, istoric compact, următoarea intervenție și adăugare. Vizualizările avansate, filtrele și exporturile vechi sunt accesibile într-o secțiune extensibilă.
- Garaj: stiluri dedicate componentei, căutare lizibilă, documente individuale, toate acțiunile și actualizarea manuală a kilometrilor păstrate.
- Raport: trei indicatori (cost, intervenții, distanță până la revizie când există date), grafic și categorii. Totalul și categoriile au aceeași perioadă ca graficul. Sunt excluse costurile necunoscute, duplicatele, datele viitoare și arhivele conform modelului existent.
- Calendar: lună și zi selectată cu evenimente alăturate pe desktop, verticale pe telefon. Adăugarea planificată păstrează ziua selectată.
- RCA & Rovinietă: două scurtături, termene reale, gestionarea documentelor și preferințele de notificare extensibile; furnizorii și linkurile existente păstrate.
- Setări: panou unitar și secțiune bilingvă «Noutăți · Racing Green 9.0», disponibilă și în aplicația conectată la domeniu.
- Suport: aspect adaptat desktop/mobil; implementarea de chat existentă, separată de AI, păstrată. Nu sunt inventate disponibilități, timpi sau date de contact.
- Culori centrale: fundal #0B1210, secundar #101A16, card #17241F; restul tokenurilor Racing Green existente. AI, autentificarea, notificările și paginile secundare moștenesc sistemul comun; logica lor nu a fost rescrisă.

## Verificări executate

- Suită completă: 337 teste trecute, 0 eșuate. După ajustarea indicatorului de revizie: 4 teste focalizate pentru raport/calendar/întreținere trecute.
- ESLint, TypeScript și build Next.js de producție: trecute.
- 60 combinații în browser: zece pagini la 360, 390, 430, 768, 1280 și 1920 px. Fără depășire orizontală a paginii în măsurători. Capturi reale ale componentelor aplicației, în mediul izolat cu date de test; acestea nu sunt capturi de Android fizic și nu implică scrieri în producție.
- Interacțiuni verificate: filtrul ITP; formular document și închidere; RO/EN; meniu mobil, navigare și închidere; ziua 29 noiembrie din Calendar și formular planificat precompletat cu 2026-11-29.
- Verificarea totalurilor include un test nou care exclude o cheltuială din afara intervalului de 12 luni atât din sumar, cât și din categorii.

## Limite și pași separați

Nu s-au făcut plăți, trimiteri de email sau modificări ale datelor reale. Testele automate folosesc baze izolate; nicio migrare nouă nu a fost introdusă. Nu am executat un flux autentificat complet în producție pentru toate operațiile destructive, upload, plăți ori furnizori AI. Acestea nu sunt declarate testate end-to-end în producție.

Proiectul Android existent deschide https://www.autocareapp.ro/cont (applicationId ro.autocare.garage). Interfața web nouă este disponibilă acelui container după încărcarea versiunii de producție. Nu există SDK Android/adb sau dispozitiv fizic în acest mediu: nu s-a generat APK/AAB nou, nu s-a publicat în Google Play și nu se declară validare pe Android real. GPS și Hartă rămân în mentenanța existentă. Prețurile, baza de date și integrarea AI nu au fost schimbate.
