# Starea livrării

**Cod funcțional implementat și verificat automat local. Nu este publicat, nu este conectat la o bază Neon aleasă și nu este validat cap-coadă cu furnizorii externi reali.**

## Implementat în sursă

| Componentă     | Ce există                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Web            | Next.js/TypeScript, design întunecat, responsive prin CSS, componente comune                                                             |
| Pagini publice | Acasă, funcționalități, pași, prețuri/comparație, întrebări, contact și trei proiecte juridice                                           |
| Cont           | Better Auth email/parolă, confirmare, resetare, schimbare parolă, profil, sesiuni, logout, ștergere                                      |
| Garaj          | Adăugare/editare/arhivare, fotografie privată, limită Free/Premium pe server                                                             |
| Documente      | Tipuri standard sau personalizate, scadență opțională, status calculat, editare versionată, istoric și arhivare                          |
| Calendar       | Calendar lunar al scadențelor active și listă de termene                                                                                 |
| Întreținere    | Lucrări, piese, service, dată, cost, citire manuală și următor prag de kilometraj                                                        |
| Cheltuieli     | Valori în bani, totaluri lunare/anuale, categorii, grafic și estimare cost/km pentru Premium                                             |
| Notificări     | Coada persistentă, intervale configurabile, preferințe, fus, revendicare atomică, deduplicare și reîncercări limitate                    |
| Email          | Transport Resend, idempotență, webhook criptografic verificat, acceptat separat de livrat                                                |
| Push           | Abonare/dezabonare, VAPID, verificare endpoint și service worker; necesită chei și dispozitiv compatibil                                 |
| Fișiere        | Upload cu limită de citire, dimensiune și semnătură de tip; download privat și ștergere                                                  |
| Premium        | Drepturi decise pe server, limită de mașini și atașamente, preferințe avansate și rapoarte                                               |
| Stripe         | Exclusiv test, checkout, portal, webhook verificat, evenimente duplicate, reînnoire, eșec, anulare și refund integral al ultimei facturi |
| Export         | Date personale JSON gratuit, inclusiv fișiere; CSV și PDF simplu pentru Premium                                                          |
| Admin          | Rol server explicit, utilizatori/activitate, abonamente, venituri de test, joburi, erori, suport, limite și audit                        |
| SEO/PWA        | Metadata, canonical pentru public, sitemap, robots, noindex privat, manifest, iconuri; fără cache privat offline                         |
| Operare        | Migrații, env exemplu, verificator configurație, script admin și scheduler, backup criptat/restaurare                                    |

## Verificat efectiv

Ultima suită: **22 teste trecute**, zero eșuate. Include testul distinct de backup/restore și 21 scenarii de funcționare. TypeScript și build-ul de producție au fost executate. Auditul npm pentru dependențele de producție raportează zero vulnerabilități cunoscute la rulare. Consultă raportul și ieșirile brute din acest director.

Baza testelor este PGlite (PostgreSQL integrat), în memorie, cu migrațiile reale. Cererile din test folosesc handlerul real Better Auth și handler-ele API Next în proces. Emailurile sunt interceptate, Web Push nu a fost expediat, iar răspunsurile serverului Stripe pentru abonamente sunt fixture-uri controlate; verificarea criptografică folosește bibliotecile reale.

## Necesar pentru a obține serviciul utilizabil public

1. Alegerea contului Neon și configurarea conexiunii către baza corectă.
2. Alegerea hostingului în buget și aprobarea separată dacă implică un cost.
3. Secrete unice și `APP_URL` HTTPS, separat pe medii.
4. Domeniu email verificat, cheie Resend și webhook de livrare.
5. Scheduler pornit efectiv și monitorizat.
6. Chei VAPID și probe pe browserele țintă.
7. Opțional: cont Stripe **test**, produs, prețuri, portal și webhook; checkout real în test și verificarea stării.
8. Probe vizuale și funcționale pe telefon și desktop. Nu au fost executate aici.
9. Completarea operatorului, contactului și verificarea juridică/fiscală.
10. Backup extern programat, rotație și o restaurare reală pe infrastructura aleasă.

Nu este corect să considerăm emailul sau push-ul real „testat” doar fiindcă transporturile și callbackurile sunt implementate. Nu este corect să considerăm proiectul „lansat” doar fiindcă build-ul trece.

## În afara acestei versiuni

- Încasări live, facturare fiscală și e-Factura.
- Rambursări parțiale și dispute automate; cazuri de charge vechi fără PaymentIntent.
- OCR, SMS, parteneri comerciali și verificări în registre oficiale.
- Familii, flote, partajarea vehiculelor.
- Android/iOS native și autentificarea nativă dedicată.
- Object storage extern, antivirus și procesare profesională a imaginilor.
- Monitorizare externă de uptime/alerte, rotația backupului și un SLA.
- Testare de încărcare, audit independent de securitate și verificare vizuală în browser.

Panoul admin permite configurarea limitelor; prețurile se modifică din env și din catalogul Stripe de test în mod coordonat. Listele admin au limite de volum, iar întregul sistem necesită paginare și optimizare înainte de o creștere substanțială.
