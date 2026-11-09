# AutoCare

Sursele complete ale aplicației existente, recuperate din directorul original și verificate față de deploymentul de producție `dpl_EFth1xktWENBaGQtW55rrWRA2rLw`, servit la https://autocare-garaj.vercel.app/ în 20 octombrie 2026.

Nu este o înlocuire cu o arhivă MVP. Codul aplicației, migrațiile, resursele și configurația de build corespund surselor publicate. Modificările locale ulterioare nepublicate au fost excluse. README-ul original este păstrat în `docs/README-DEPLOYMENT-ORIGINAL.md`; rapoartele istorice descriu starea la data redactării lor.

## Module

- Dashboard, Garaj, Documente, Calendar, Întreținere, Cheltuieli și istoric auto.
- Autentificare Better Auth, sesiuni și autorizare pe server.
- PostgreSQL / Neon prin Drizzle, migrații și atașamente private.
- Premium plătit și manual, Stripe, prețuri 50 RON/lună și 500 RON/an.
- Notificări Web Push și email, scheduler, centru de suport și conversații cu roluri verificate.
- Panou Fondator: utilizatori, roluri, Premium, prețuri, suspendare, audit și configurare Search Console.

## Dezvoltare locală

Node.js 24, apoi `npm ci`. Configurează local variabilele descrise în `docs/ENVIRONMENT.md`, fără să le adaugi în Git. Pentru dezvoltare izolată se poate folosi PGlite prin `LOCAL_DATABASE_PATH`; nu folosi baza de producție pentru teste.

```sh
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run db:migrate`, comenzile administrative și scripturile de backup au efecte asupra bazei configurate: se rulează doar separat și intenționat. Recuperarea surselor nu a executat migrații și nu a modificat Neon.

## Proveniență și verificare

Vezi `docs/RECOVERY.md` și `docs/PRODUCTION-SOURCE-MANIFEST.json`. Fișierele `.env*`, parolele și tokenurile reale, baze locale, copii de siguranță cu date, încărcări private, `node_modules` și `.next` nu sunt incluse.

Importul în GitHub nu conectează automat repository-ul la Vercel și nu lansează o versiune nouă în producție. Configurările externe existente rămân în serviciile lor; nu sunt copiate în surse.


### AutoCare Maps

`AUTOCARE_ROUTING_URL` sets the server-side base URL of an OSRM driving instance (for example, the default `https://routing.openstreetmap.de/routed-car`, without `/route/v1`). The endpoint receives the two coordinates only when the user requests a route or active guidance detects a deviation. Use an OSRM instance provisioned for the expected traffic at scale. The route estimates do not include real-time traffic. `AUTOCARE_OVERPASS_URL` overrides the OpenStreetMap POI endpoint. The default uses a Europe-wide Overpass instance for European queries, including Romania, and the global Overpass endpoint elsewhere. Queries use coordinates rounded to two decimal places. Phone, opening hours and address are displayed when supplied by OpenStreetMap.
