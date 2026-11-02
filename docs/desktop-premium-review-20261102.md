# AutoCare — redesign web pentru desktop, 2 noiembrie 2026

## Schimbări

- Ramură separată: feature/autocare-desktop-premium-20261102. Redesign livrat în Preview; producția nu este modificată.
- Sistemul vizual existent al contului a fost actualizat: antet și navigare grafit, accent cyan discret, fundal gri, suprafețe luminoase pentru citirea documentelor și completarea formularelor. Stilurile rămân limitate la zona autentificată.
- Dashboard cu grilă de 12 coloane: cardul mașinii și lucrarea prioritară au proporții diferite; documentele urgente și acțiunile rapide sunt alăturate; costurile și istoricul au ponderi diferite.
- Cardul mașinii active afișează fotografia proprie prin endpointul existent, autorizat, dacă aceasta există. Fără fotografie sau la eroare se afișează ilustrația AutoCare cu bifă. Preview nu solicită fotografii private pentru identificatori fictivi.
- Rezumate separate pentru ulei și distribuție (distribuția în Premium). Sunt reutilizate selecția intervențiilor curente și calculele existente de timp/kilometraj; lipsa datelor nu generează estimări inventate. Butoanele deschid înregistrarea sau formularul real.
- Premium: prezentare grafit cu ilustrație AutoCare, contrast corectat, comparația și beneficiile existente păstrate. Alegerea planului navighează direct la pagina separată Abonament. Planurile sunt alăturate pe desktop și stivuite pe telefon.
- Prețurile reale configurate rămân 150 lei/lună, 450 lei/3 luni, 1.700 lei/an în configurația verificată; nu s-a introdus prețul propus de 50 lei.
- Contrastul pictogramelor și textelor din antet, al deconectării și al secțiunilor Premium a fost corectat. Categoriile formularului folosesc o singură coloană sub 380px.
- Loginul, înregistrarea, schema bazei de date, API-urile de salvare, abonamentele și integrarea plăților nu au fost modificate.

## Verificări

- Suita existentă: 158 teste trecute, inclusiv persistență izolată, securitate, abonamente și calcule de întreținere.
- Build Next.js și ESLint.
- Browser desktop: dashboard, garaj, intervenții, documente, kilometraj, calendar, cheltuieli, istoric, SmartDrive, Premium, Abonament și Cont. Fără depășire orizontală în paginile parcurse.
- Fotografia decorativă se încarcă în cardul mașinii; navigarea și deschiderea formularului de distribuție funcționează.
- Browser în container de 320px: dashboard și formularul cu categoriile de intervenții, fără depășire orizontală. Preview folosește date fictive declarate și nu salvează în conturi reale.
- Modificările nesalvate din formular solicită confirmare înainte de închidere.

## Limite

- Nu s-au făcut plăți reale, teste GPS în mișcare, trimiteri de notificări sau modificări ale datelor utilizatorilor.
- Fotografiile personale sunt protejate de autentificare; în Preview s-a verificat ilustrația de rezervă. Testarea unei fotografii reale încărcate necesită un cont autorizat cu acea fotografie.
- Deconectarea este intenționat dezactivată în Preview. Logica reală nu s-a modificat; suita existentă verifică invalidarea sesiunii după logout.
