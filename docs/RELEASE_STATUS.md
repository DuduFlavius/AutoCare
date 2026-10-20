# AutoCare — publicare premium, 20 octombrie 2026

## Sursă și Git

Sursa completă a deployment-ului anterior de producție dpl_5NPcopHsAoUFqhh4avt65Tu4whMh a fost recuperată și comparată cu implementarea nouă. Blocajul de recuperare menționat în rapoartele anterioare este rezolvat.

Codul este versionat într-un repository Git local separat, cu istoricul inclus în AutoCare.git.bundle. Nu a fost încărcat în DuduFlavius/Roomly. Pentru push pe GitHub este necesar un repository AutoCare separat, existent și accesibil: integrarea disponibilă nu permite crearea repository-urilor, iar browserul cere autentificare.

## Compatibilitate

- Păstrate autentificarea automată existentă, sesiunile de 30 zile și regulile de origine/cookie. Confirmarea e-mailului poate fi activată explicit prin AUTOCARE_REQUIRE_EMAIL_VERIFICATION=true; nu este impusă retroactiv conturilor existente.
- Păstrate normalizarea domeniului, readAt și acțiunile citit/necitit ale notificărilor.
- Păstrată tabela originală support_messages și importate mesajele în modelul nou. Migrațiile noi au nume distincte de migrațiile deja executate.
- Fondatorul este legat pe server de ID-ul contului existent indicat de utilizator. Nu se atribuie primul cont și nu se folosește un câmp editabil din profil.
- Premium-ul manual existent este importat cu aceeași expirare, fără plată, fără încasări fictive. Revocarea manuală nu poate fi ocolită prin vechea înregistrare din subscriptions.
- Prețuri afișate și API: 50 RON/lună și 500 RON/an. Checkout verifică prețul real al procesatorului; catalogul Stripe nu a fost modificat și nu s-au efectuat tranzacții.

## Baza de date

Doar proiectul AutoCare identificat prin schema autocare_migrations a fost migrat. Copie înainte de migrare: autocare-pre-premium-20261020; verificare separată: autocare-migration-check-20261020. Migrațiile au trecut întâi pe copie și apoi în tranzacție pe ramura originală.

După migrare au rămas 2 utilizatori, 1 mașină, 1 înregistrare și 0 fișiere, aceleași numere ca în copie. Acces manual importat: 1. Nu s-au șters date. Roomly nu a fost modificat.

## Verificări

49/49 teste trecute, TypeScript, ESLint și build Next.js trecute. Include persistență între procese, autentificare și resetare, origine/canonical, izolarea utilizatorilor, fotografii/atașamente, backup, migrații, Fondator, Premium manual și chat. Verificarea end-to-end cu parola contului real nu a fost efectuată. Testarea vizuală completă pe dispozitive reale rămâne necesară.

## Deployment

Țintă: production, proiect autocare-garaj, echipa roomlyy.
Deployment: dpl_5EXbpESFQZcGFy2XsYMR9Spws4ut.
Domeniu principal: https://autocare-garaj.vercel.app
Stare confirmată: READY. Aliasul autocare-garaj.vercel.app indică acest deployment. API pricing răspunde 200 cu 5000/50000 bani RON; dashboard fără sesiune răspunde 401; /cont redirecționează la autentificare; /start anonim revine la homepage; pagina /previzualizare este 404 în producție. Browserul a confirmat noul formular de autentificare pe domeniul principal. Scanarea erorilor runtime indică numai avertismentul deja existent al driverului PostgreSQL despre sintaxa sslmode, fără erori noi de aplicație în intervalul verificat.
