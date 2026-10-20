# AutoCare — Sidebar și fotografie panoramică

Implementare 20 octombrie 2026, pe proiectul AutoCare existent.

## Fișiere modificate
- src/components/dashboard.tsx: sidebar, badge necitite din date reale, actualizare la 30 secunde și revenirea în fereastră, drawer cu focus trap/Escape/închidere în exterior, profil cu rol real și meniu de deconectare, confirmare pentru formulare nesalvate.
- src/components/brand.tsx: simbol auto Lucide și Auto/Care alb/albastru în sidebar.
- src/components/garage-home.tsx: selectarea mașinii când există mai multe, fotografia privată asociată, următorul termen cu categoria reală și data, sortarea existentă după expirare păstrată.
- src/components/automotive-hero.tsx: fotografie panoramică din mașina selectată, efecte comune, fallback imagine de prezentare și fallback final grafic.
- src/app/autocare-ui.css: sidebar 256px, gradient, navigare compactă, focus, reduced-motion, drawer sub 1000px, hero cu object-fit cover și gradienți, stări Premium distincte.

## Date și securitate
Nicio migrare, niciun rol, abonament sau preț schimbat. Fotografiile rămân pe endpoint privat autorizat cu Cache-Control private, no-store. Founder nav este condiționat de rolul efectiv din backend; /admin și API rămân protejate. Premium citit din dashboard server, fără valori demonstrative în producție. Fotografiile mici nu primesc artificial detalii inexistente.

## Verificări executate
- 58/58 teste existente trecute.
- TypeScript și lint trecute.
- Build de producție local trecut, repetat după ultimele ajustări.
- Previzualizare Vercel: fotografie încărcată, sidebar inspectat vizual desktop.
- Toate cele 11 butoane de navigare activate în browser; aria-current verificat pentru fiecare; Documente inspectat separat.
- În consola capturată au apărut mesaje ale extensiei browserului; nu au fost observate erori ale aplicației în această navigare.

## Limite ale verificării
Nu există o sesiune de Fondator disponibilă în browser, deci nu se declară testare vizuală live a fiecărui rol/Premium sau a badge-urilor cu notificări reale. Permisiunile sunt acoperite de testele existente backend. Drawer-ul și regulile responsive sunt implementate, dar nu s-a executat verificare pe iPhone/Android fizic. Nu se declară verificarea tuturor fotografiilor posibile; acestea depind de rezoluția și încadrarea originalului.
