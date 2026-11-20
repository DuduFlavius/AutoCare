# SmartDrive GPS 4.0 — Android și suprafețe discrete

Navigația este exclusiv Android. Web/PWA/iOS nu montează harta live și nu cer localizarea pentru SmartDrive. Păstrează istoricul și kilometrajul autentificate. Cele două endpointuri vechi de căutare/rutare răspund 410 (401 pentru utilizatori anonimi); nu există un header de browser care să deblocheze navigația.

Android folosește o metodă nouă în pluginul Capacitor, `navigationRequest`. Cererile HTTPS ajung direct la furnizorii existenți Photon și routing.openstreetmap.de. Nu sunt introduse chei în aplicație, trafic fictiv sau un furnizor nou. Domeniile sunt fixe, redirecționările refuzate, coordonatele validate, răspunsurile limitate la 12 MB și 12 secunde. Căutarea are 12 cereri/minut, rutarea 8/minut, maximum două cereri native simultane. Furnizorii publici nu oferă un SLA garantat.

Versiunea Android necesară: 1.7.0 (21). Aplicațiile vechi au nevoie de actualizare pentru noua metodă de rutare. Înregistrarea și sincronizarea vechilor curse nu sunt șterse sau migrate. Ieșirea din navigație și oprirea înregistrării rămân independente.

Harta nativă ocupă ecranul complet și înainte de ghidare, indiferent de lățimea Androidului. Înapoi nu oprește serviciul de înregistrare. Istoricul/Bluetooth sunt într-un meniu secundar; în ghidare rămân numai manevra, harta și HUD-ul. Camera și filtrarea GPS existente sunt păstrate, fără map matching fictiv.

Pagina publică `/smartdrive-gps` și varianta `/en/smartdrive-gps` au metadate, hreflang, FAQ și SoftwareApplication, fără ratinguri sau prețuri inventate. Vechile URL-uri Smart GPS redirecționează permanent. Istoricul privat nu este indexabil. Nu au fost inventate capturi Android; galeria cu capturi reale necesită un dispozitiv disponibil pentru verificare.

La nivel vizual, componenta cu 13 linii a fost înlocuită cu o lumină ambientală, decorurile SVG fără rol funcțional nu mai au contururi repetate, iar bordurile cardurilor sunt neutre. Culorile de stare, focusul, graficele reale și acțiunile principale rămân distincte. Garajul și pagina publică nu mai folosesc acele fascicule de linii.

Buildul QA și release-ul semnat sunt separate. Release-ul păstrează mediul protejat `android-release`, configurația Firebase existentă și verificarea certificatului față de APK-ul public anterior și App Links. Dacă lipsesc cheile sau aprobarea mediului, publicarea APK-ului trebuie raportată ca blocată, fără a ocoli protecția. APK-ul de QA are identificatorul `.preview`.

Testele automatizate ale API-urilor, parserelor și URL-urilor native nu validează GPS-ul rutier. Rămân necesare verificări fizice Android: orientare în mers, semnal slab, ecran blocat, conexiune întreruptă, tastatură, safe areas, sincronizarea pe drum cunoscut și capturi reale înainte/după. Nicio astfel de verificare nu este declarată efectuată în absența dispozitivului.
