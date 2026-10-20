# Configurare, deployment și operare

Niciun serviciu plătit nu a fost activat. Nu sunt incluse credențiale. Aceste instrucțiuni pregătesc pașii operatorului; nu sunt o afirmație că mediile externe au fost configurate sau testate.

## 1. Neon

Alege contul/organizația în care dorești proiectul AutoCare. Existau mai multe conexiuni posibile; nu s-a făcut o alegere arbitrară.

1. În Neon, creează un proiect Free separat, preferabil într-o regiune UE disponibilă. Verifică prețurile și limitele afișate efectiv în cont.
2. Creează o bază de dezvoltare și una de producție sau ramuri izolate; nu trimite emailuri reale din ramuri de test cu copii de utilizatori.
3. Copiază conexiunea PostgreSQL **pooled**, cu SSL, în `DATABASE_URL`. Nu folosi o variabilă `NEXT_PUBLIC_DATABASE_URL`.
4. Pentru migrații și operațiuni administrative, folosește conexiunea adecvată din acel mediu. Nu aplica migrații simultan. Testează mai întâi pe o ramură izolată.
5. Rulează `node --env-file=.env.local --import tsx scripts/migrate.ts`.
6. Nu activa și Neon Auth în paralel presupunând că se va conecta automat: implementarea curentă este Better Auth din aplicație, cu tabele proprii.

Neon Free poate fi suspendat la depășirea limitelor. Istoricul implicit de restaurare din documentația consultată este de 6 ore pe Free, dar verifică setarea proiectului. Acest istoric nu înlocuiește backupul extern.

## 2. Secrete și medii

Folosește o parolă/cheie aleatoare unică pentru `BETTER_AUTH_SECRET`, minimum 32 caractere, și o altă valoare pentru `CRON_SECRET`. Generează-le local cu un generator criptografic, de exemplu `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Nu reutiliza exemplele sau cheile din testele automate.

`APP_URL` trebuie să fie URL-ul exact al aplicației, fără slash final. Folosește HTTPS în producție. Numele și prețurile vizibile se setează prin `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_MONTHLY_PRICE`, `NEXT_PUBLIC_ANNUAL_PRICE`. Sunt singurele valori publice de configurație din exemplu; cheile furnizorilor rămân server-side.

În Vercel, configurează distinct Development, Preview și Production. Preview nu trebuie să folosească baza sau emailul producției. Nu pune `.env.local` în Git. După schimbarea prețurilor publice sau numelui, reconstruiește aplicația.

## 3. Email Resend

1. Creează/selectează contul potrivit, fără upgrade automat.
2. Verifică un domeniu pe care îl deții deja și înregistrează DNS-urile cerute de Resend (SPF/DKIM și celelalte instrucțiuni ale furnizorului).
3. Configurează `RESEND_API_KEY` și `EMAIL_FROM` cu expeditorul verificat.
4. Creează un cont de test în aplicație și verifică efectiv primirea emailului, confirmarea și recuperarea parolei. Verifică și spamul.
5. Configurează webhookul Resend la `https://URL-UL-TAU/api/v1/email/webhook` pentru `email.delivered`, `email.bounced`, `email.failed` și salvează cheia semnăturii în `RESEND_WEBHOOK_SECRET`.
6. Monitorizează consumul: Free are 100 emailuri/zi și 3.000/lună la verificarea efectuată. Aplicația nu face upgrade și nu promite o cotă nelimitată. Un răspuns 429 intră în politica limitată de reîncercare.

Dacă serviciul lipsește, nu există un email fictiv în interfață. Contul poate rămâne neconfirmat și utilizatorul poate cere retrimiterea după configurare. Erorile se văd în loguri și în istoricul alertelor, după caz.

## 4. Scheduler

`vercel.json` conține apelul la 15 minute pentru `/api/v1/jobs/reminders`. Necesită un plan Vercel care acceptă această frecvență. **Nu face upgrade doar pentru a satisface fișierul.** Hobby acceptă numai zilnic și nu este potrivit lansării comerciale descrise.

Setează `CRON_SECRET` în Vercel; cron-ul trimite antetul Bearer corespunzător. Endpointul refuză cererile neautorizate. Jobul programează și apoi livrează prin funcții distincte; rezultatele persistă în baza de date.

Alternativă fără activarea Vercel Cron: un server/PC disponibil poate executa la 15 minute:

```sh
node --env-file=.env.scheduler --import tsx scripts/run-reminders.ts
```

`.env.scheduler` are numai `APP_URL` și `CRON_SECRET`; fișierul trebuie protejat. Pe Windows folosește Task Scheduler, cu directorul de lucru al proiectului și calea completă la Node. Pe Linux folosește cron sau un timer systemd. Această programare **nu a fost creată** în mediul utilizatorului. Nu stoca tokenul în argumentele unei comenzi publice sau în loguri.

Verifică `job_runs` din Administrare, coada, livrările eșuate și consumul. Configurează un control extern de sănătate înainte de lansare: alerta dacă nu există o rulare reușită timp de o oră. Acest monitor extern nu este inclus/configurat. Dacă schedulerul lipsește o zi, sistemul nu promite recuperarea tuturor intervalelor ratate.

## 5. Web Push și PWA

Generează local perechea VAPID:

```sh
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Salvează `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` și `VAPID_SUBJECT=mailto:adresa-ta`. Cheia privată nu ajunge în browser. Permite HTTPS și publică `sw.js`, manifestul și iconurile. În Setări, utilizatorul activează push printr-o acțiune explicită. Dacă browserul nu suportă sau refuză permisiunea, emailul rămâne separat.

Pe iOS verifică instalarea web app pe ecranul principal și versiunile compatibile. Testează și Android/desktop separat. Nu există cache offline al contului sau documentelor; această alegere limitează expunerea datelor sensibile. PWA nu este o aplicație nativă și nu este o garanție de funcționare offline.

Sunt acceptate endpointuri HTTPS din domeniile configurate în API pentru FCM, Mozilla și Apple. Un alt furnizor valid trebuie adăugat deliberat după verificare, nu prin acceptarea oricărei adrese din browser.

## 6. Stripe — numai mediu de test

Stripe publică tarife și servicii pentru România. Disponibilitatea pentru societatea, activitatea și verificările tale KYC trebuie confirmată în cont; acest lucru nu a fost făcut în numele tău.

1. Creează/selectează contul și activează modul test, fără încasări reale.
2. Configurează un produs Premium și două prețuri recurente RON: lunar 14,99 și anual 119,99, sau valorile pe care le validezi comercial.
3. Setează `STRIPE_SECRET_KEY` cu cheia **sk_test\_...**, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID` și prețurile vizibile corespunzătoare.
4. Activează portalul clientului în test, cu anulare și gestionarea metodei de plată.
5. Configurează webhookul la `/api/v1/billing/webhook`, salvează `STRIPE_WEBHOOK_SECRET` și selectează evenimentele `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`.
6. Efectuează un checkout Stripe de test după documentația furnizorului. Confirmă actualizarea planului numai după webhookul verificat. Revenirea în browser nu acordă Premium.
7. Testează reînnoire, anulare, plată eșuată, eveniment repetat și rambursarea integrală a ultimei facturi.

Starea abonamentului este recitită de pe serverul Stripe la procesarea evenimentelor relevante. Un abonament active cu ultima factură neplătită nu acordă Premium. Refundul integral al ultimei facturi suspendă accesul până la o nouă factură eligibilă; evenimentele vechi nu trebuie să reactiveze aceeași factură rambursată. Refunduri parțiale, dispute, cazuri vechi fără PaymentIntent, fiscalitatea și e-Factura sunt în afara acestei implementări și trebuie rezolvate înainte de live.

Cheile live și evenimentele live sunt refuzate în această versiune. Trecerea la live necesită cerere explicită, configurare și verificare suplimentară; nu se face prin simpla lipire a unei chei live.

## 7. Vercel și alternativa pe server existent

Proiectul nu a fost publicat. Pentru Vercel:

1. Pune sursa într-un repository privat pe care îl controlezi; exclude secretele, `.local`, `node_modules`, `.next`.
2. Importă proiectul ca Next.js. Build: `npm run build`. Node 24 este mediul testat; alege un runtime suportat de platformă și verifică noul build.
3. Verifică planul și bugetul înainte de activare. Configurația cron curentă nu este compatibilă cu Hobby.
4. Completează variabilele mediului de staging; migrează baza înainte de prima utilizare.
5. Configurează URL-ul exact și secretele din acel mediu. Fă deploy în staging, apoi execută lista de acceptanță de mai jos.
6. Promovează doar după probele externe și verificarea textelor juridice. Nu folosi mediul de test drept serviciu comercial live.

Pe un server existent, aplicația poate folosi același PostgreSQL și același cod: build, `npm start`, supervisor pentru proces, HTTPS prin reverse proxy și scheduler de sistem. Configurează proxy-ul să **suprascrie** `X-Real-IP`; nu permite clientului să-l falsifice. Nu expune direct portul intern Node. În Vercel, configurația autentificării folosește headerul platformei `x-vercel-forwarded-for`; verifică rezolvarea IP-ului în acel deployment. Dacă headerul nu este disponibil, Better Auth revine la limitarea comună pe rută, ceea ce poate limita utilizatori diferiți simultan.

## 8. Backup și restaurare

Implementarea include backup complet AES-256-GCM și test automat de restaurare într-o bază integrată izolată. Nu există încă backup programat al unei baze Neon reale.

1. Generează local o cheie de 32 octeți, în hex, și salvează-o drept `BACKUP_KEY`. Păstreaz-o separat de backup și de repository.
2. Programează backup zilnic în afara aplicației web. Rulează scriptul `scripts/backup.ts create` cu env-ul bazei corecte și o cale nouă absolută. Nu afișa/expune datele decriptate sau parolele.
3. Copiază fișierul criptat pe un suport/furnizor diferit, autorizat. Verifică accesul și spațiul. Nu păstra cheia lângă fișier.
4. Politică inițială propusă: 7 backupuri zilnice; expiră și șterge copiile mai vechi. Această rotație nu este automatizată în proiect.
5. Pentru restaurare: creează o bază separată goală, aplică migrațiile aceleiași versiuni, setează `DATABASE_URL` către destinația izolată, `BACKUP_KEY` și `RESTORE_TARGET_EMPTY=YES`, apoi rulează `scripts/backup.ts restore`.
6. Scriptul refuză o bază care conține deja date în tabelele aplicației. Nu restaura peste producție și nu dezactiva acest control.
7. Verifică numărul de utilizatori, vehicule, înregistrări și fișiere, autentificarea și câteva atașamente. Revocă sesiunile restaurate înainte de a expune o bază recuperată dacă incidentul impune acest lucru. Nu porni schedulerul/emailul într-o clonă de restaurare cu utilizatori reali.

Ținte propuse, **nemăsurate în producție**: pierdere maximă de date 24h cu backup zilnic și timp de recuperare sub o zi. Durata, dimensiunea bazei, păstrarea WAL și restaurarea Neon trebuie probate efectiv. Testul cu PGlite nu validează un SLA Neon sau recuperarea dezastrului pe infrastructura ta.

## 9. Retenție și ștergere

Datele contului se păstrează cât timp contul este activ. Arhivarea oprește alertele, dar păstrează istoricul. Ștergerea contului elimină prin cascade baza activă, documentele, fotografiile, istoricurile și sesiunile; metadatele de callback asociate sunt eliminate de hookul autentificării când legătura există. Webhookurile fără legătură sunt curățate după 30 zile. Backupurile păstrează date până la rotația lor, propusă la 7 zile; la recuperare trebuie reaplicate cererile de ștergere intervenite ulterior backupului.

Curățarea jobului elimină contoarele API mai vechi de 2 zile, rate-limit auth mai vechi de 7 zile, callbackuri email mai vechi de 30 zile și audit administrativ mai vechi de 90 zile. Dacă jobul nu rulează, curățarea nu este executată. Auditul păstrează metadate de securitate, fără documente sau parole. Verifică juridic perioadele înainte de lansare.

Conturile cu un abonament activ/past_due/trialing/unpaid trebuie să rezolve anularea înainte de ștergere, inclusiv prin endpointurile directe Better Auth. Înainte de plăți reale trebuie implementată separat retenția fiscală și informarea contractuală; de aceea live este blocat.

## 10. Probe obligatorii înainte de public

- Cont real de test: înregistrare, email, confirmare, autentificare, resetare și logout.
- Două conturi distincte: modificarea URL/ID nu permite accesul la fișierele sau mașinile celuilalt.
- O mașină, document cu scadență, service, cheltuială și atașament; apoi editare și arhivare.
- Testează un termen programat pentru ziua de test și verifică toate cele trei niveluri: job, acceptare furnizor, callback de livrare. Nu considera simplul HTTP 200 al cronului drept alertă livrată.
- Probează Web Push pe dispozitivele țintă, inclusiv permisiune refuzată și abonament expirat.
- Probează checkout Stripe test, evenimente duplicate, anulare, plată eșuată și refund.
- Testează interfața la 360 px, tabletă și desktop; tastatură, dialoguri, upload, erori și liste goale.
- Restaurează un backup real într-o bază izolată și validează atașamentele.
- Completează operatorul, contactul, documentele juridice și configurația comercială.
- Confirmă bugetul, cotele și alerta de consum. Nicio probă nu justifică automat un upgrade.
