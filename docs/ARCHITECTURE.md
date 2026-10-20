# Arhitectură și contract API

## Structura codului

- `src/app`: pagini Next.js, metadata, sitemap, robots și manifest PWA.
- `src/components`: interfață publică, autentificare și contul utilizatorului.
- `src/lib/schema.ts`: schema Drizzle; migrațiile SQL sunt în `migrations`.
- `src/lib/service.ts`: autorizare, limite, garaj, înregistrări, statistici, fișiere și CSV.
- `src/lib/auth.ts`: Better Auth, confirmare, resetare, sesiuni și limitare de cereri.
- `src/lib/reminders.ts`: programare separată de livrare și rezultate per încercare.
- `src/lib/email-events.ts`: verificarea semnăturilor evenimentelor de livrare.
- `src/lib/billing.ts`: Stripe exclusiv test, verificare server și idempotență.
- `src/lib/backup.ts`: export complet criptat și restaurare exclusiv în destinație goală.
- `scripts`: migrare, configurare, rol admin, backup/restore.
- `tests`: fluxuri reale în proces cu PostgreSQL compatibil, transporturi externe înlocuite în test.

## Model relațional

`app_user` este părintele sesiunilor, profilului, mașinilor, înregistrărilor, fișierelor și abonamentului. `account`, `session`, `verification`, `rate_limit` sunt schema Better Auth. `profiles` conține rolul și preferințele, nu câmpuri pe care browserul le poate schimba arbitrar.

`records` modelează documente, lucrări și cheltuieli prin `kind` cu constrângere SQL. Astfel, o factură de service poate contribui o singură dată la costuri, fără dublarea automată într-un tabel de cheltuieli. Atașamentele se leagă de aceste înregistrări. `record_history` păstrează versiunile anterioare. `vehicle_photos` păstrează o imagine privată per vehicul.

`subscriptions`, `invoices`, `webhook_events`, `settings` modelează starea planurilor, facturile de test și idempotența evenimentelor. Prețurile comerciale sunt în env, iar ID-urile Stripe trebuie configurate pentru aceleași valori; simpla schimbare a etichetei nu modifică prețul în Stripe.

`notifications` este coada persistentă. Cheia unică `(recordId, revision, channel, offset)` oprește dublarea programării. `delivery_attempts` înregistrează fiecare rezultat de transport. `email_events` păstrează callbackurile furnizorului și permite reconcilierea dacă un callback ajunge înaintea salvării ID-ului de trimitere. `pushes` conține abonamentele browserului. `job_runs`, `support`, `audit`, `request_limits` susțin operarea.

Cheile externe compuse leagă proprietarul fișierului/înregistrării/fotografiei de proprietarul părintelui. Valorile monetare sunt numere întregi de bani RON. Expirările sunt șiruri validate strict `YYYY-MM-DD` fără oră; statusul se calculează după data locală din fusul utilizatorului. Momentele de eveniment și sesiune sunt `timestamptz`.

Migrațiile se aplică în ordine lexicografică și sunt înregistrate în `autocare_migrations`. Nu rula două procese de migrare simultan. După modificarea schemei folosește Drizzle generate, inspectează SQL-ul și testează într-o bază izolată înainte de aplicare.

## API

Toate operațiunile de mai jos verifică sesiunea și emailul confirmat. ID-ul utilizatorului este extras din sesiune. Cererile care modifică date trebuie să aibă `Origin` egal cu `APP_URL`; acest control completează cookie-urile sigure și protecțiile Better Auth.

| Rută `/api/v1/...`            | Metodă         | Comportament                                                                                  |
| ----------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `dashboard`                   | GET            | Date proprii; statisticile avansate sunt eliminate pentru Free                                |
| `vehicles`                    | POST           | Adăugare, limită verificată tranzacțional                                                     |
| `vehicles/:id`                | PATCH / DELETE | Editare / arhivare                                                                            |
| `vehicles/:id/photo`          | POST / GET     | Fotografie proprie, maximum 2 MB                                                              |
| `records`                     | POST           | Document, lucrare sau cheltuială                                                              |
| `records/:id`                 | PATCH / DELETE | Modificare versionată / arhivare                                                              |
| `records/:id/history`         | GET            | Istoric propriu                                                                               |
| `profile`                     | PUT            | Preferințe validate, fără acces la rol                                                        |
| `files`                       | POST           | Multipart `file`, `recordId`; tip și dimensiune limitate                                      |
| `files/:id`                   | GET / DELETE   | Download privat / ștergere                                                                    |
| `export?format=json`          | GET            | Export personal gratuit, inclusiv fișiere Base64 și metadate de sesiune, fără parole/tokenuri |
| `export?format=csv` sau `pdf` | GET            | Raport Premium; PDF simplu, font cu transliterarea diacriticelor                              |
| `push`                        | POST / DELETE  | Înregistrare / dezactivare; destinații HTTPS de furnizori acceptați                           |
| `support`                     | POST           | Mesaj înregistrat pentru administrator                                                        |
| `account`                     | DELETE         | Confirmare textuală și parolă, blocat pentru abonament activ                                  |
| `billing/checkout` / `portal` | POST           | Stripe test; URL generat de server                                                            |
| `billing/invoices`            | GET            | Facturi proprii de test                                                                       |
| `admin`                       | GET            | Verificare rol server, metadate; fără documentele utilizatorilor                              |
| `admin/limits`                | PUT            | Configurare limite și audit                                                                   |
| `admin/support/:id`           | PATCH          | Închidere mesaj și audit                                                                      |
| `jobs/reminders`              | GET            | Excepție de sesiune: necesită `Authorization: Bearer CRON_SECRET`                             |
| `billing/webhook`             | POST           | Excepție de sesiune: semnătură Stripe, raw body, numai test                                   |
| `email/webhook`               | POST           | Excepție de sesiune: semnătură Svix/Resend                                                    |

Autentificarea Better Auth are rutele proprii sub `/api/auth`. Nu există endpoint de acordare Premium sau admin din browser. Exporturile și fișierele folosesc `no-store`. Paginile private nu sunt indexabile. Service workerul nu cachează datele private.

## Livrarea alertelor

Schedulerul selectează datele calendaristice după fus și ora utilizatorului, creează intrări unice și nu trimite pentru documente/vehicule arhivate sau conturi neconfirmate. În Free sunt permise 30, 7, 1 și 0 zile. Premium poate selecta și 14, 6, 5, 4, 3, 2 zile, un memento după expirare și praguri de kilometraj. Alertele după expirare și kilometraj se emit o singură dată per versiune, nu zilnic la infinit.

Livrarea revendică atomic o intrare. O revendicare abandonată poate fi reluată după 2 minute. Reîncearcă maximum 4 ori, cu backoff; fereastra maximă este 23 ore și data locală trebuie să rămână aceeași. Emailul folosește o cheie idempotentă stabilă a furnizorului. Configurarea absentă și unele erori permanente opresc reîncercările. După remediere, un operator trebuie să decidă dacă este necesară o nouă alertă; nu există retrimitere nelimitată automată.

Jobul livrează în loturi de până la 50 intrări și se oprește după aproximativ 40 secunde de procesare a lotului. Preferințele și proprietatea se verifică din nou înaintea trimiterii. Un webhook verificat poate schimba acceptat în livrat sau eșuat. Acest lucru nu confirmă citirea mesajului.

Pentru Web Push se folosește un tag per notificare pentru a înlocui repetările vizibile. Suportul iOS/Android este dependent de browser și permisiuni. Sistemul nu este un canal de urgență.
