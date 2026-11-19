# AutoCare Racing Green — audit de implementare, 19 noiembrie 2026

## Sursă și protecția datelor
Bază: `2e28096c1785749efa9c3c1669f881a413da7164`, ramura cu funcțiile integrate validate. Copie de siguranță: `backup/pre-racing-green-8-20261119`. Baza de date, conturile, prețurile, permisiunile și cheile de integrare nu au fost modificate de redesign. Modificările independente de pe main au fost comparate; nu s-a înlocuit implementarea mai nouă Gmail/Mail Center cu furnizorul mai vechi din acea ramură.

## Implementare
- Paleta globală canonică este Racing Green: #0B1210, #101A16, #17241F, #1E4538, #34C997, #71E5BB, #F3F8F5, #A5B8AF, #304B40. Culorile semantice pentru avertizări/erori rămân distincte.
- Eliminat stratul emerald adăugat anterior și trei foi vechi de stil ale dashboardului de referință. Regulile globale vechi se opresc la granița componentelor noi `rg-*`; nu concurează cu layoutul lor. Culorile vechi au fost refactorizate în surse, inclusiv grafice și formulare.
- Desktop Home reconstruit: patru statistici reale, evoluția cheltuielilor, listă garaj, următoarea intervenție, documente și acces AI. Iconițele de referință raster au fost înlocuite cu pictograme vectoriale unitare. Varianta existentă Brand păstrează identitatea AutoCare.
- Mobile Home: vehiculul real, kilometraj/ITP, intervenție și progres calculat doar dacă există un interval km valid, patru scurtături, sumar și cheltuieli. Nicio fotografie auto sau telemetrie fictivă.
- Meniu lateral: nouă secțiuni principale; instrumentele suplimentare sunt grupate. Închidere X/Escape, navigare și gest spre stânga. Abonamentul reflectă starea reală.
- Documente: filtre de categorie, căutare/opțiuni într-un panou extensibil, carduri compacte, meniu de acțiuni și încărcare. Acțiunile originale de fișiere/arhivare/ștergere cu confirmare rămân.
- Întreținere mobilă: trei indicatori, cost zero păstrat corect, istoric în carduri, intervenție următoare, formular existent. Nu se numără lucrările viitoare ca realizate.
- Raport: General / Detalii și export, sumar, grafic real cu întreruperi pentru luni fără înregistrări, categorii, filtre și PDF/CSV existente. Conversia orientativă EUR folosită anterior rămâne etichetată explicit în Home; datele originale sunt în RON.
- Calendar lunar reconstruit cu alinierea zilelor, an bisect, evenimente reale și selectarea datei în formularul unei lucrări noi. Un eveniment nou rămâne POST, nu editarea unei înregistrări inexistente.
- RCA/Rovinietă, Setări și suport au aspect unitar. Suportul și AI sunt separate. Nu se afișează disponibilitate sau timpi de răspuns fictivi. AI păstrează istoricul, compozitorul și acțiunile; o conversație goală începe sus.
- Android: URL-ul WebView existent este https://www.autocareapp.ro/cont, ID ro.autocare.garage. Culorile barelor și splash-ului au fost actualizate; versiunea sursă este 1.6.0 / 20. Un APK/AAB nou este necesar pentru schimbările native; interfața web se livrează prin domeniul configurat.
- SmartDrive/Hartă: mentenanța și permisiunile existente nu au fost activate sau relaxate.

## Verificare
- 336 de teste automate au trecut; două teste noi acoperă calendarul/anul bisect, izolarea evenimentelor și costul zero față de lucrările viitoare.
- ESLint, TypeScript și build Next.js de producție au trecut; rezultatele finale sunt revalidate înainte de publicare.
- Browser: 54 de combinații pagină/lățime la 360, 390, 430, 768, 1280, 1920 px; scrollWidth nu depășește clientWidth. Capturi reale ale componentelor aplicației, cu date de test izolate, nu date introduse în producție.
- Verificări interactive: meniu/navigare/închidere, ITP și URL-urile exporturilor filtrate, perioade raport, calendar/zi/eveniment, precompletarea 29.11.2026 în formular, RO/EN și accesul la securitatea contului.
- Comparațiile înainte folosesc commitul de bază; sunt comparații de cod executat, nu capturi ale unei sesiuni autentificate vechi de pe domeniul public.

## Limite explicite
- Nu s-a testat pe un telefon Android/iPhone fizic. Nu există SDK/adb pentru generarea și instalarea unui release Android în acest mediu. Nu se declară AAB semnat sau publicare Google Play.
- Previzualizarea dezactivează trimiterile AI, încărcările, plățile și modificările contului. Nu se pretinde testarea end-to-end a acestor furnizori în producție și nu s-au trimis emailuri sau plăți de test.
- Capturile de dashboard folosesc fixture-ul izolat din proiect, inclusiv scenarii fără date. Nu sunt date de producție. Fidelitatea structurală a fost verificată; nu se pretinde identitate pixel cu pixel sau utilizatori fictivi copiați din referință.
- Domeniul www.autocareapp.ro nu era atașat proiectului Vercel accesibil la început. Legătura domeniului și starea deploymentului se confirmă separat după publicare, nu se deduc din build.

## Fișiere modificate
- `mobile/android/app/build.gradle`
- `mobile/android/app/src/main/res/drawable/autocare_launch_mark.xml`
- `mobile/android/app/src/main/res/values-v27/styles.xml`
- `mobile/android/app/src/main/res/values/autocare_launch.xml`
- `mobile/android/app/src/main/res/values/styles.xml`
- `public/emerald-reference/aurora.svg`
- `src/app/(romanian)/open-app/style.css`
- `src/app/apple-splash/route.tsx`
- `src/app/autocare-ui.css`
- `src/app/automotive-workspace.css`
- `src/app/design-system.css`
- `src/app/emerald-theme.css`
- `src/app/globals.css`
- `src/app/luxury-public.css`
- `src/app/manifest.ts`
- `src/app/mobile-app.css`
- `src/app/premium-dashboard.css`
- `src/app/premium-unified.css`
- `src/app/premium.css`
- `src/app/product-finish.css`
- `src/app/product-identity.css`
- `src/app/product-intro.css`
- `src/app/product-system.css`
- `src/app/reference-redesign.css`
- `src/app/studio-public.css`
- `src/app/titanium-landing.css`
- `src/app/ultra-cockpit.css`
- `src/components/account-settings.css`
- `src/components/action-menu.css`
- `src/components/admin-premium.css`
- `src/components/app-workspace.css`
- `src/components/application/account.tsx`
- `src/components/application/auto-ai-premium.css`
- `src/components/application/auto-ai-workspace.tsx`
- `src/components/application/auto-ai.css`
- `src/components/application/cockpit-home.css`
- `src/components/application/document-vault.tsx`
- `src/components/application/finance-center.css`
- `src/components/application/finance-center.tsx`
- `src/components/application/garage.css`
- `src/components/application/header.tsx`
- `src/components/application/home-clarity.css`
- `src/components/application/home.tsx`
- `src/components/application/mobile-cockpit.tsx`
- `src/components/application/mobile-finance-overview.tsx`
- `src/components/application/mobile-navigation.tsx`
- `src/components/application/mobile-reference.css`
- `src/components/application/product-refinement.css`
- `src/components/application/racing-screens.tsx`
- `src/components/application/racing-support.tsx`
- `src/components/application/reference-dashboard.css`
- `src/components/application/report-overview.tsx`
- `src/components/auth-premium.css`
- `src/components/auto-update.tsx`
- `src/components/car-art.tsx`
- `src/components/dashboard.tsx`
- `src/components/document-controls.css`
- `src/components/feedback.css`
- `src/components/filter-select.css`
- `src/components/garage-home.tsx`
- `src/components/landing-cockpit.tsx`
- `src/components/language-menu.tsx`
- `src/components/language-switch.css`
- `src/components/mail-center.tsx`
- `src/components/mail-studio.css`
- `src/components/membership-premium.css`
- `src/components/mobile-polish.css`
- `src/components/premium-downloads.tsx`
- `src/components/premium-workspace-theme.css`
- `src/components/public-ai-intro.css`
- `src/components/raster-road-map.tsx`
- `src/components/record-editor.tsx`
- `src/components/reference-artwork.tsx`
- `src/components/road-map.tsx`
- `src/components/share-image.tsx`
- `src/components/site-document.tsx`
- `src/components/smartdrive-premium.css`
- `src/components/studio-workspace.css`
- `src/components/subscription-premium-layout.css`
- `src/components/support-center.css`
- `src/components/titanium-wave.tsx`
- `src/components/workspace-redesign.css`
- `tests/racing-calendar.test.ts`
