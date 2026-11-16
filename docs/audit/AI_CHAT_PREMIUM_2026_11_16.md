# AutoCare AI — redesign și verificări, 16 noiembrie 2026

## Implementare

- Interfață navy, albastru și mov, cu un singur set de reguli vizuale pentru chat; eliminarea suprapunerilor succesive din vechiul fișier de stiluri.
- Header compact cu identitate AutoCare AI, disponibilitate bazată pe configurația existentă a furnizorului (nu monitor de uptime), conversație nouă, istoric și opțiuni.
- Întâmpinare cu cinci acțiuni reale pentru cheltuieli, revizie, documente, simptome și istoric service. Cererile folosesc vehiculul selectat și serviciul existent de context: cheltuieli, documente, service, kilometraj și praguri de întreținere. Nicio informație demonstrativă adăugată în producție.
- Bule utilizator cu lățime după conținut; răspunsuri Markdown lizibile, fără HTML injectat; copiere, regenerare și feedback util/neutil. Regenerarea adaugă o variantă și păstrează originalul.
- Conversații distincte salvate pe server, restaurate din istoric după autentificare și între dispozitive. Titlurile se construiesc din prima întrebare disponibilă; nu se pretinde generare de titluri printr-o cerere AI separată. Mesajele vechi fără identificator de conversație sunt grupate pe zile, fără rescriere.
- Ștergere limitată la conversația selectată, cu confirmare. Toate operațiile verifică utilizatorul și vehiculul. Limitele existente de istoric/retention (150 mesaje returnate, maximum 200 păstrate de serviciu) nu au fost extinse.
- Casetă de scriere separată de mesajele care derulează, dimensionată cu visualViewport pentru tastatura mobilă; Enter trimite, Shift+Enter adaugă un rând; indicator de procesare și blocarea trimiterilor paralele. Oprirea așteptării nu garantează anularea cererii pe server, fapt explicat utilizatorului.
- Scanarea PDF/JPEG/PNG existentă este accesibilă prin agrafă, păstrează limita de 2 MB și confirmarea câmpurilor înainte de salvare. Nu este atașare multimodală la mesaj: fișierul este folosit pentru extragerea datelor.
- Textele noi sunt RO/EN. Instrucțiunea de limbă este repetată explicit la furnizor și are prioritate față de istoricul în altă limbă. Mesajele vechi nu sunt traduse sau alterate automat. Respectarea limbii de către un model extern nu poate fi garantată exclusiv printr-un test cu furnizor simulat.

## Date și compatibilitate

Backup cod: `backup/pre-ai-chat-premium-2026-11-16`.
Migrarea `0014_ai_conversations.sql` adaugă doar `conversationId`, `feedback` și un index. Nu modifică întrebări, răspunsuri, date de vehicule, abonamente sau prețuri. Reexecutarea este verificată. Aplicația anterioară poate ignora coloanele noi în cazul revenirii la codul de backup. Această ramură este backup de cod, nu un export separat al bazei de date.

## Verificări

- Lint, TypeScript și build de producție trecute.
- Teste pentru conversații separate, context izolat, limbă RO/EN, feedback persistent, acces între conturi refuzat, ștergere selectivă, migrare repetabilă, mesaje vechi păstrate, regenerare fără suprascriere și eșec de furnizor fără răspuns fabricat.
- Testele existente pentru Premium, expirarea abonamentului, documente, scanare, limite și proprietatea vehiculului rămân în suită; feedbackul este inclus în verificarea refuzului pentru Premium expirat.
- Furnizorul AI este simulat exclusiv în testele locale. Nu au fost folosite mesaje/documente fictive în conturile de producție.

## Limită de verificare vizuală

Scriptul `scripts/audit/ai-chat-browser.mjs` pregătește verificarea componentei reale la 1440×960 RO, 390×844 RO și 360×740 EN, cu API simulat într-un server local izolat. Lansarea Chromium a fost blocată de restricțiile de socket ale mediului; browserul conectat nu are context disponibil, iar browserul alternativ nu poate accesa serverul local. Aceste teste vizuale și de tastatură NU sunt raportate ca trecute. Nu există încă verificare a noii interfețe pe Android/iOS reale sau dovadă de trimitere a unei întrebări AI dintr-un cont Premium autentificat pe producție.

Verificarea publicării, a migrației și a endpointurilor fără autentificare se adaugă după confirmarea Render.

## Rezultat publicare

- Suita finală: **282/282 teste trecute**, 0 eșecuri; lint și build trecute.
- Render LIVE: `dep-dbta14rm8hqs73aa8gh0`, commit aplicație `e68eb6f7b84b0e4e814387415e189297701fb2be`.
- `/api/app-version` confirmă acest commit, HTTP 200.
- Logul pornirii confirmă `Additive migrations completed.` și pornirea Next. Verificarea existentă a furnizorului raportează modele AI disponibile; aceasta nu echivalează cu o conversație completă de producție.
- Istoricul AI, trimiterea mesajului și feedbackul refuză accesul fără autentificare (HTTP 401). URL-ul secțiunii AI redirecționează vizitatorii neautentificați către autentificare.
- Există avertismentul pg privind aliasurile SSL înaintea unei viitoare versiuni majore. Nu s-a slăbit verificarea TLS și nu s-au schimbat credențialele sau variabilele serverului.
- Planul de găzduire rămâne Free, fără activarea unui cost nou. Limitarea de repaus Render discutată anterior nu este rezolvată prin acest redesign.
