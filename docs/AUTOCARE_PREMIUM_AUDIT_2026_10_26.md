# AutoCare Premium — audit incremental și specificație de redesign
Data: 26 octombrie 2026
Ramură: feature/autocare-premium-rebuild
Producția și baza de date nu sunt modificate de acest audit.

## Surse inspectate
- package.json, src/app/layout.tsx, src/app/design-system.css, src/app/premium-unified.css
- src/components/record-editor.tsx, src/components/service-detail-fields.tsx
- docs/AUDIT.md, docs/RELEASE_STATUS.md, docs/DASHBOARD_AUDIT.md, docs/REDESIGN_2026_10_20.md
- arborele complet al repository-ului main

## Constatări confirmate în sursă
1. Next.js 16.4.2, React 19.2.4, Better Auth, Drizzle ORM, PostgreSQL, web-push și Stripe sunt în dependențe; prezența nu dovedește funcționarea în producție.
2. Există componente pentru Dashboard, Garaj, formular de intervenție, câmpuri specifice categoriei, chat de suport și panou Fondator.
3. Există manifest PWA, service worker și pagină de instalare. Instalarea și livrarea push pe dispozitive reale nu au fost certificate în acest audit.
4. Există migrații SQL, inclusiv pentru suport și acces Premium. Nu au fost executate migrații noi.
5. Formularul de intervenție acceptă kilometraj, costuri, termen ulterior și detalii pe categorie; are validări de bază, prevenire dublu-submit și separă cost necunoscut de cost zero.
6. layout.tsx încarcă succesiv design-system.css, globals.css, premium.css, autocare-ui.css, reference-redesign.css, premium-unified.css. Ultimul strat folosește numeroase reguli !important, ceea ce crește riscul de regresii vizuale.
7. Documentul RELEASE_STATUS.md raportează 49 teste trecute la 20 octombrie 2026. Nu sunt teste rerulate în această etapă; raportul istoric nu este o certificare curentă.

## Specificația designului aprobat
- Desktop: sidebar albastru închis, topbar alb, fundal #f3f7fc, carduri albe cu margini discrete, accent albastru #1268e5.
- Dashboard: mașină activă, kilometraj confirmat, revizie viitoare, documente care expiră, intervenții recente, cheltuieli și acțiuni rapide.
- Mobil: layout separat, fără scalarea desktopului; navigație accesibilă cu degetul, carduri pe o coloană, fără scroll orizontal; respectă safe-area iOS.
- Formulare: câmpuri clare, costuri în RON, kilometraj, date, termene, tipuri de piese, explicații contextuale; salvare reală și erori inteligibile.
- Nu se afișează valori demonstrative drept date reale și nu se inventează intervale oficiale de service.

## Riscuri prioritare
P0: reconcilierea sursei main cu deploymentul de producție, backup verificat înainte de migrații.
P0: verificarea accesului la date pe server și a configurării secrete.
P1: consolidarea CSS fără a rupe ecranele existente; teste responsive 320, 375, 390, 430, 768, 1024 și 1440 px.
P1: verificarea notificărilor PC/iOS/Android și a suportului mobil; push necesită permisiuni și mecanism de livrare.
P1: testarea persistenței intervențiilor și recalculării termenelor.
P2: GPS browser — separarea distanței estimate de kilometrajul confirmat; limitări de fundal.
P2: testarea instalării PWA și actualizărilor service worker.

## Plan de implementare cu verificări
1. Audit comparativ Vercel / GitHub și teste de bază pe ramura de lucru.
2. Refactorizare controlată a design tokens și a stratului CSS, fără modificarea fluxurilor de date.
3. Dashboard + Garaj responsive, urmate de formularul de intervenție și câmpurile dinamice.
4. SmartDrive, întreținere, documente, cheltuieli, calendar, suport și notificări.
5. Teste unitare, integrare, build, browser responsive, PWA și testare pe dispozitive reale.
6. Preview deployment; aprobarea utilizatorului înainte de merge și publicare.

## Starea acestei etape
Audit static parțial și specificație scrisă. Nu au fost rulate teste, nu au fost modificate componente de producție, nu s-a făcut deployment.
