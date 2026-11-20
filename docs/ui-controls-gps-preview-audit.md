# Audit global UI și SmartDrive — 20 noiembrie 2026

**Stare: implementare în Preview, fără publicare în producție înainte de validarea fondatorului.** Datele, tarifele, permisiunile și schema bazei de date nu au fost modificate.

## Probleme și corecții

| Prioritate | Componentă | Problemă și corecție |
|---|---|---|
| Critică | Meniuri contextuale | `display:grid` putea suprascrie `hidden`. Vizibilitatea respectă acum explicit atributul HTML. |
| Importantă | Confirmări | Utilizările native confirm din Documente, Suport, AI, GPS, feedback, kilometraj și administrare trec prin dialogul comun React. Anulare, Escape, focus pe Anulează, Tab, restaurare focus, fundal inert și RO/EN. |
| Importantă | Mutări concurente | O singură decizie activă; apăsările repetate nu creează confirmări duplicate. Dashboardul are un blocaj sincron pentru mutații; fluxurile Document/Service păstrează dialogul deschis în timpul cererii și afișează eroarea. |
| Importantă | Selectoare | Toate selectoarele JSX din aplicație folosesc FilterSelect; sunt păstrate numele, valorile, FormData, required, opțiunile dezactivate și resetarea formularelor. Liste în portal, navigare cu tastatura, poziționare în viewport. |
| Importantă | Calendar | Contrast corect pentru ziua selectată; date reale, ani bisecți, min/max și ore validate. Alegerea lunii/anului și calendarul existent sunt păstrate. |
| Importantă | Tastatură | Escape închide meniul/selectul, fără să închidă și formularul părinte. Recalcularea poziției la modificarea visual viewport pentru tastatura mobilă. |
| Importantă | Navigare între secțiuni | Apelanții așteaptă confirmarea modificărilor nesalvate înainte de schimbarea filtrelor/panourilor. |
| Importantă | SmartDrive mobil | Hartă fără card exterior, titlu exterior ascuns în modul hartă, Istoric/Bluetooth într-un meniu compact, căutare flotantă retractabilă, panou inferior extensibil. |
| Importantă | Ghidare activă | Hartă fixată în viewportul mobil, antetul și bara generală ascunse, safe areas respectate, ieșire din navigație separată de oprirea înregistrării. Înregistrarea kilometrilor la pornirea navigației este o opțiune explicită. |

Rămân intacte rutarea reală, camera 3D, filtrele GPS, serviciile native foreground și endpointurile idempotente de salvare. Nu s-a introdus map matching fictiv, trafic inventat sau precizie simulată. Nu au fost eliminate verificările suplimentare pentru ștergerea contului.

Nu există apeluri aplicative native alert sau prompt de introducere a textului în inventarul surselor. Solicitările native de instalare PWA și permisiuni Android sunt păstrate; componentele sistemului pot avea culorile sistemului de operare.

## Verificări și limite

- Lint, TypeScript și build de producție au fost executate. Rezultatele finale sunt precizate în livrare.
- Testele includ autentificare, izolarea conturilor, sincronizare idempotentă a kilometrilor, filtrare GPS, RO/EN, calendar, documente și abonamente. Au fost adăugate teste pentru date invalide și confirmări concurente/anulare/demontarea dialogului.
- Un rulaj cu multe procese simultane s-a oprit la push-delivery în timpul buildului. Recontrolul izolat al acelui fișier a trecut; suita finală a fost reluată cu concurență redusă. Eșecul inițial nu este ascuns.
- Local: descărcarea Gradle a fost reparată folosind proxy-ul deja configurat; `cap sync android` a trecut. Mediul Java local nu are javac, deci nu se revendică un APK compilat local.
- GitHub Actions: `assembleDebug`, `testDebugUnitTest` și `lintDebug` au trecut. APK QA separat, fără semnare de producție sau publicare în magazine.
- Accesul vizual la Preview a fost refuzat de verificarea automată deoarece redirecționează către domeniul Vercel. Nu s-a ocolit protecția. Capturile înainte/după, verificarea consolei și testele interactive nu sunt prezentate ca efectuate.
- Nu există telefon Android fizic disponibil. Camera în deplasare, semnalul slab, ecranul blocat, consumul bateriei, revenirea din fundal și precizia cer validarea fondatorului. Testele simulate nu sunt echivalate cu testare rutieră.

## Validarea fondatorului înainte de producție

1. Deschide `/previzualizare/controale` în Preview. Testează RO/EN, Anulează, Escape, confirmare, apăsări repetate și eroare de server simulată. Contorul nu trebuie să crească la anulare sau eroare. Datele de aici sunt exclusiv demonstrative.
2. Verifică opțiunile lungi/dezactivate, tastatura, resetarea formularului și date imposibile/min/max. Escape trebuie să închidă doar selectorul.
3. Cu un cont de test autorizat, verifică separat Documente, Intervenții, Garaj, AI, Suport și ștergerea contului. Nu folosi date reale importante pentru operații distructive de test.
4. SmartDrive: verifică 360/390/430 px, landscape, tastatură și safe areas. Închide/deschide căutarea, extinde/restrânge detaliile, ieși din navigație fără a opri înregistrarea.
5. Android real: navigație fără înregistrare, apoi cu înregistrare; drum cunoscut, ecran blocat, fundal, lipsă temporară internet, reconectare, notificare nativă și recuperarea sesiunii.
6. La oprire, verifică răspunsul serverului, istoricul și kilometrajul după reîncărcare. Retrimiterea aceleiași curse nu trebuie să dubleze distanța.
7. Capturează înainte de navigație, ghidare activă, căutare deschisă și desktop. Producția necesită corectarea diferențelor și aprobarea explicită.

APK-ul de test utilizează domeniul Preview al ramurii și are identificator separat `.preview`. Protecția Vercel poate solicita accesul fondatorului. Fișierul APK nu reprezintă o versiune validată pe drum și nu actualizează aplicația publică.
