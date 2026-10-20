# Recuperarea surselor de producție AutoCare

Data: 20 octombrie 2026. Destinație: DuduFlavius/AutoCare.

## Sursa recuperată

Director original disponibil: `/workspace/scratch/1f63af7e4a93/source/autocare`.
Checkpoint local: `c1ec2fa`.
Deployment READY care servește domeniul de producție: `dpl_EFth1xktWENBaGQtW55rrWRA2rLw`.
Domeniu: https://autocare-garaj.vercel.app/.

Copierea s-a făcut din checkpoint-ul original, într-un director izolat. Nu s-a folosit arhiva MVP și nu s-au inclus modificările locale nepublicate din dashboard, API și teste.

## Comparația cu Vercel

104 fișiere de sursă/build/configurație/resurse:

- 95 comparate prin SHA-1 integral cu identificatorii din arborele surselor deploymentului.
- 9 aflate în directoare trunchiate de răspunsul conectorului au fost solicitate după SHA-1-ul conținutului local la API-ul de fișiere al aceluiași deployment. Toate cele 9 au fost găsite. Pentru 4 răspunsuri s-a comparat conținutul complet; pentru 5 conectorul a trunchiat conținutul base64 la 2000 de caractere: prefixul coincide, iar identificatorul de recuperare este chiar SHA-1-ul conținutului local. Nu se pretinde descărcarea integrală a celor 5 răspunsuri trunchiate.
- Nu lipsesc fișiere de aplicație din directorul original. Manifestul listează fiecare cale și SHA-1.

README.md a fost actualizat ca documentație de recuperare; versiunea sa identică celei din deployment este păstrată în `docs/README-DEPLOYMENT-ORIGINAL.md`. Documentația și testele din checkpoint-ul original au fost păstrate, împreună cu acest raport și inventarul variabilelor de mediu.

## Excluderi intenționate

- Toate fișierele `.env*`, inclusiv `.env.example`. În `docs/ENVIRONMENT.md` sunt numai numele variabilelor.
- Chei API, tokenuri, parole și alte credențiale reale. Datele de test sintetice folosesc domenii `.invalid` și valori demonstrative, nu conturi de producție.
- Date Neon, baze locale PGlite, copii de siguranță cu date personale, fotografii și documente private ale utilizatorilor, conversații, sesiuni.
- `.local`, `.git` original, bundle-uri Git, `node_modules`, `.next`, `*.tsbuildinfo` și `next-env.d.ts` regenerabil de Next.js.

Excluderile nu sunt fișiere de aplicație nerecuperabile. Configurările și datele existente rămân în serviciile externe. Nu a fost exportată baza de date.

## Verificări executate pe copia recuperată

- `npm run build`: trecut.
- `npm run typecheck`: trecut.
- `npm run lint`: trecut.
- `npm test`: 58/58 trecute, baze de test izolate și servicii simulate. Fără operațiuni pe Neon.
- Scanare fișiere și conținut pentru credențiale reale, chei private și identificatori personali cunoscuți: fără rezultate publicabile sensibile.

Niciun deployment, nicio migrare și nicio conectare GitHub–Vercel nu au fost efectuate în această recuperare. Istoricul Git local complet nu este publicat pentru a evita includerea accidentală a materialelor istorice sau a metadatelor personale; este importat snapshot-ul verificat al codului în istoricul existent al noului repository.
