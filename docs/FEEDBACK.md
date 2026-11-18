# Feedback AutoCare

Disponibil pentru conturi gratuite și Premium în Cont → Trimite feedback și în Centrul de suport. Administratorii, superadministratorii și fondatorul au o coadă separată; asistenții de suport nu primesc acces administrativ la feedback.

- Sugestie, raportare problemă, experiență; secțiune opțională și 1–5 stele opționale.
- Mesaje de 10–5.000 caractere, maximum două imagini PNG/JPEG/WebP de 2 MB fiecare. Imaginile sunt validate, decodificate și recodificate PNG fără metadate; nu sunt importate automat documente, GPS sau alte date.
- Salvare atomică a mesajului și imaginilor, chei de idempotență, maximum 5 trimiteri în 24h, interval minim 60s; răspunsuri limitate separat. Reîncercarea aceleiași cereri nu dublează feedbackul sau notificările.
- Status: nou, analiză, lucru, rezolvat, închis. Priorități normală/ridicată/critică, răspunsuri și istoric. Modificările administrative folosesc o revizie pentru a evita suprascrierile concurente.
- Notificări în aplicație persistente; push generic respectând preferința existentă. Un eșec push nu anulează salvarea și este înregistrat în feedback_notices.pushState. Deschiderea push trimite utilizatorul la Feedback și administratorul la coadă.
- Invitație discretă doar după minimum 7 zile și 3 înregistrări, o singură dată, cu verificarea sesiunii GPS native și web. Nu apare în formulare/dialoguri sau când câmpurile sunt active. Închiderea se păstrează în bază și pe dispozitiv.
- Fișiere și mesaje private, verificări server, origine și sesiune obligatorii, fără cache. Exportul datelor personale și backupul includ feedbackul; ștergerea contului elimină datele asociate prin cascade.

Migrare aditivă: migrations/0019_feedback.sql. Verificată pe PGlite și pe o ramură Neon izolată înainte de aplicare. Copie înainte de migrare: autocare-pre-feedback-20261118. Numărul utilizatorilor și al înregistrărilor existente nu s-a schimbat.

Verificări: 320 teste automate trecute (incluzând API autentificat, atașamente private, izolare, spam, deduplicare, roluri, status/răspuns/istoric, notificări, traduceri, invitație și backup). Formularul și panoul au fost verificate în browser, desktop și viewport mobil, inclusiv alegerea capturii, stele, filtre și RO/EN. Android primește interfața comună de la www.autocareapp.ro; rutarea push este verificată prin testul integrării Android. Nu s-a efectuat un test pe dispozitiv Android fizic sau de recepție push pe un dispozitiv fizic. Nu este necesară schimbarea APK-ului pentru interfața de feedback.

Nu s-au schimbat abonamentele, prețurile sau permisiunile GPS. Pentru rollback se poate reveni la deployment-ul anterior; tabelele aditive pot rămâne fără a afecta codul vechi. Nu șterge feedbackul pentru un rollback de interfață.

Corecții UI asociate: selectoare mașină vizibile în Documente, SmartDrive și AI; ieșire AI pe mobil; meniuri de acțiuni în portal; previzualizare imagine/PDF încadrată, lățime și zoom. Ștergerea definitivă a documentelor/cheltuielilor este separată de arhivare, cere confirmare și revizie, verifică proprietarul pe server și elimină atașamentele asociate. Testele folosesc exclusiv date fictive.
