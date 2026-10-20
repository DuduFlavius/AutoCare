# Audit tehnic și comercial

Evaluare: 19 octombrie 2026. Master brief-ul curent înlocuiește prețurile din fișierul inițial: **14,99 lei/lună**, **119,99 lei/an**, buget infrastructură **maximum 100 lei/lună**. Numele AutoCare este configurabil și nu reprezintă validarea unei mărci sau a unui domeniu.

## Situația inițială și alegerea arhitecturii

Directorul de lucru nu conținea un proiect. Nu au fost găsite conexiuni de aplicație sau variabile de mediu de proiect. Au fost observate mai multe conturi Neon disponibile în conector; nu a fost ales și modificat niciunul fără identificarea celui dorit. Nu s-a creat infrastructură externă.

Next.js 16.4.2 și TypeScript sunt folosite pentru UI și API. Versiunea Next a fost verificată în registrul npm înainte de instalare; Node 24.19.0 a executat build-ul. React 19.2.4, Better Auth 1.7.11 și Drizzle 0.45.4 sunt fixate în proiect și în lockfile. Restul versiunilor rezolvate sunt în `package-lock.json`; instalările reproductibile folosesc `npm ci`.

**Drizzle în loc de Prisma:** schemă TypeScript, PostgreSQL și PGlite prin adaptoare cu aceeași interfață; tranzacții, chei externe și migrații SQL inspectabile. Nu este necesar un serviciu separat pentru ORM.

**Better Auth administrat în aplicație:** permite dezvoltarea și testarea autentificării fără alegerea unui cont Neon; utilizatorii și sesiunile rămân în aceeași bază. Neon Auth gestionat este o alternativă, dar nu a fost provisionat și nu este folosit concomitent. Nu există o implementare proprie a parolelor.

**Backend comun:** regulile sunt în `src/lib`, API-ul versionat în `/api/v1`. UI nu decide planul sau proprietarul datelor. Pentru aplicații native va fi necesară adaptarea autentificării, a transportului sesiunii și a politicilor magazinelor; modelul de date și regulile pot fi păstrate.

**Fișiere în PostgreSQL pentru MVP:** upload/download privat implementat efectiv, fără un serviciu de fișiere neconfigurat. Base64 adaugă aproximativ 33% la dimensiune. Maxim 2 MB, 2 atașamente în Free și implicit 30 în Premium, plus o fotografie per mașină. Nu este soluția recomandată pentru volume mari. Object storage privat cu URL-uri temporare este o migrare ulterioară explicită, nu o integrare declarată existentă.

## Prioritizare

| Obligatoriu MVP                              | Premium implementat            | Ulterior                      |
| -------------------------------------------- | ------------------------------ | ----------------------------- |
| Cont, confirmare email, recuperare, sesiune  | Mai multe mașini, implicit 5   | Familii și roluri partajate   |
| O mașină gratuită și documente               | Alerte personalizate           | Flote mici                    |
| Revizii și evidență de cheltuieli            | Praguri după kilometraj manual | OCR cu confirmare             |
| Scheduler, email, istoric, control duplicate | Rapoarte PDF/CSV, statistici   | SMS separat aprobat           |
| Fișiere private, export personal, ștergere   | Atașamente suplimentare        | Android/iOS native            |
| Admin, audit, backup criptat                 | Stripe test și portal test     | Facturare fiscală / e-Factura |

## Costuri verificate și scenarii

Prețurile furnizorilor sunt cele publicate la verificare, în moneda lor. Nu este folosit un curs valutar inventat. Taxele, consumul suplimentar și cursul cardului pot schimba totalul în lei.

| Componentă              | Nivel observat                                                                             | Impact inițial                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Hobby            | 0 USD, utilizare personală necomercială; cron cel mult o dată/zi, precizie la nivel de oră | Nu este baza recomandată pentru lansarea acestui produs comercial                                                                 |
| Vercel Pro              | 20 USD/lună, un loc de deployment și 20 USD credit de utilizare; taxe și depășiri separat  | Poate depăși bugetul de 100 lei după conversie și taxe; necesită aprobare înainte de activare                                     |
| Neon Free               | 100 CU-ore/proiect/lună, 1 GB stocare/proiect, scale to zero                               | Potrivit pentru validare în limite; stocarea documentelor consumă repede spațiul; fără promisiune de disponibilitate de producție |
| Resend Free             | 3.000 emailuri/lună, 100/zi                                                                | 0 USD în limite; include confirmări, recuperări și mementouri în volumul estimat                                                  |
| Resend Pro              | 20 USD/lună pentru 50.000 emailuri, costuri suplimentare conform paginii                   | Nu activat; depășește singur o parte mare a bugetului                                                                             |
| Web Push                | Fără tarif per mesaj perceput de codul aplicației                                          | Consum server și rețea; suport variabil; permisiune obligatorie                                                                   |
| Stripe standard SEE     | 1,5% + 1 leu pentru card standard SEE; Billing pay-as-you-go 0,7%                          | Cost variabil per abonament, nu infrastructură fixă; alte carduri, conversii, dispute și taxe separat                             |
| Domeniu / backup extern | Nu a fost cumpărat sau contractat                                                          | Se bugetează după alegerea furnizorului; backupurile nu au fost încă programate extern                                            |

Exemplu calculat pentru Stripe, fără TVA, dispute, conversii sau alte servicii: la 14,99 lei, 1 + 14,99 × 2,2% ≈ **1,33 lei**; la 119,99 lei ≈ **3,64 lei**. Rămân aproximativ 13,66 lei/lună, respectiv 116,35 lei/an înaintea celorlalte cheltuieli și taxe. Aceste calcule nu validează prețurile comerciale.

Exemplu de volum: 20 utilizatori × 1 mașină × 3 documente × 4 alerte ≈ 240 emailuri într-o lună cu toate scadențele. La 100 de utilizatori cu 5 mașini × 4 documente × 10 alerte pot exista până la 20.000 mesaje într-o lună aglomerată. Limita zilnică poate fi atinsă mult mai devreme decât limita lunară.

**Varianta cu cel mai mic cost pentru validare:** dezvoltare locală + Neon Free (opțional) + Resend Free, fără hosting comercial deschis public. Costul furnizorilor poate fi zero în limite.

**Alternativa pentru buget strict:** aplicația Next poate rula pe un server existent, protejat cu HTTPS și reverse proxy, cu cron de sistem și baza Neon Free. Nu presupunem existența sau disponibilitatea unui astfel de server pentru acest proiect. Curentul, administrarea, backupul și disponibilitatea rămân costuri reale. Nu a fost instalată pe un server extern.

## Riscuri și limite

1. Necesită operator tehnic pentru deploy, secrete, domeniu email, monitorizare și incidente; un fondator fără experiență nu ar trebui să ignore aceste operațiuni.
2. Cron-ul la 15 minute poate trezi des Neon; 100 CU-ore pot deveni insuficiente. La volum mic se poate trece la o oră, cu mementouri aproximative și reîncercări mai lente, după măsurare.
3. Fișierele în PostgreSQL, exportul complet și backupul în memorie sunt potrivite unui MVP mic, nu arhivelor masive. Dimensiunea bazei și latența trebuie monitorizate.
4. Emailul acceptat nu garantează livrarea; webhookul verificat poate confirma livrarea sau respingerea. Schedulerul nu asigură un SLA.
5. Push nu oferă exact-once în toate condițiile. Browserul folosește același tag pentru memento, pentru a înlocui repetările vizibile; erorile între acceptare și salvarea rezultatului rămân un caz distribuit dificil.
6. Generarea alertelor scanează înregistrările eligibile; procesarea este în loturi. Testarea de încărcare și paginarea pentru volume mari nu au fost făcute.
7. Rambursarea integrală a celei mai recente facturi revocă Premium în modul test. Rambursările parțiale și disputele necesită o politică de afaceri și implementare suplimentară.
8. Nu există scanare antivirus/OCR pentru documente. Tipurile, semnătura inițială, dimensiunea și accesul sunt controlate; documentele se descarcă drept atașamente.
9. Textele juridice sunt proiecte. Nu garantează conformitatea GDPR, fiscală sau contractuală.
10. Necesită probe în browser pe mobil/desktop, email real, push real și Stripe test înainte de lansare. Codul nu este prezentat drept auditat independent sau complet certificat.

## Surse oficiale consultate

- https://nextjs.org/docs/app/getting-started/installation
- https://better-auth.com/docs/adapters/drizzle
- https://better-auth.com/docs/authentication/email-password
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/plans/pro-plan
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://neon.com/pricing
- https://neon.com/docs/introduction/branching (istoric Free implicit: 6 ore; paid implicit: o zi; confirmă setarea proiectului ales)
- https://resend.com/pricing
- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://stripe.com/en-ro/pricing
- https://docs.stripe.com/webhooks
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

Aceste pagini pot fi actualizate. Reconfirmă înainte de activarea unui plan sau începerea încasărilor.
