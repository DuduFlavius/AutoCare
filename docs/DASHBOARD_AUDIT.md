> Starea actuală este documentată în docs/RELEASE_STATUS.md (sau RELEASE_STATUS.md din acest director). Restricția anterioară de recuperare a sursei este rezolvată.

# Dashboard AutoCare — audit și implementare

20 octombrie 2026. Continuă sursa livrată anterior. Producția nu este înlocuită: este necesară reconcilierea cu sursa completă a versiunii publicate, care este mai nouă decât arhiva inițială.

## Modificări

- Automotive Hero editorial grafit/albastru, imagine mare, salut personalizat și acțiuni funcționale pentru Garaj și operațiune. Fără mașină, acțiunile pornesc adăugarea primei mașini.
- Selectarea fotografiei proprii din mașinile active cu fotografie; fișierul rămâne privat. Imaginea implicită este etichetată ca fotografie de prezentare. Eșecul fotografiei personale folosește fotografia implicită; dacă și aceasta eșuează, apare un fallback grafic, fără buclă de reîncărcare. Fotografiile personale sunt încadrate fără tăiere forțată.
- «Pentru tine»: următorul termen real, documente cu atenționări, istoric service și costurile lunii curente. Fără date, mesaje și acțiuni utile, fără recomandări tehnice inventate.
- «De reținut»: maximum trei priorități ordonate cronologic, inclusiv termene depășite; altfel un singur pas relevant pentru completarea contului.
- Statistici compacte și clicabile, sub hero: mașini, documente în termen peste 30 zile, termene care necesită atenție, costuri cunoscute ale lunii. Datele arhivate și mașinile arhivate sunt excluse. Costurile necunoscute sunt explicite și excluse din total. Luna se calculează în fusul orar al contului.
- Navigarea privată prin logo revine la Dashboard fără ieșirea din cont și fără reîncărcare. Logo-ul public folosește /start: verificare server a sesiunii, redirect privat doar pentru cont verificat, homepage pentru anonim. Erorile temporare de verificare răspund 503, nu sunt tratate fals ca logout. Răspunsurile nu sunt cache-uite.
- Navigare Back/Forward între secțiuni, URL actualizat, element activ accesibil prin aria-current. Avertizare la abandonarea formularelor pentru înregistrări și mașini; beforeunload păstrat. API 401 oferă reconectare și păstrează datele formularului.
- Layouturi telefon/tabletă/desktop, imagini și acțiuni adaptive. Prețurile 50/500 RON, rolurile, permisiunile, baza de date și formularele existente sunt păstrate.

## Verificare

44 teste automate trecute. Testele noi verifică destinația logo-ului cu sesiune verificată reală de test, anonim și după logout; refuzul accesului anonim la API; încărcări repetate autentificate; cont gol, mașini/înregistrări arhivate, priorități, costuri și limita de lună în fusul Europe/Bucharest. Toate cele 39 de teste anterioare rămân trecute.

TypeScript, ESLint și build Next.js trecute. Testele nu modifică producția și nu execută plăți reale.

Verificarea vizuală pe telefon/tabletă reale și provocarea unei erori reale de încărcare a fotografiei nu sunt certificate în browserul disponibil; fallbackul și breakpointurile sunt implementate. Conturile reale și sursa mai nouă din producție necesită verificare după reconciliere.

Preview: https://autocare-garaj-dvr8gf7du-roomlyy.vercel.app/previzualizare

Verificare desktop: hero, secțiunea Pentru tine și formularul operațiunii afișate. Confirmarea la închidere a fost anulată în browser și categoria Frâne a rămas selectată. Selectorul fotografiei a fost mutat în fluxul normal pentru a nu se suprapune cu acțiunile.
