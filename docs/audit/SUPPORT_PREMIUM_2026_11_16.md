# AutoCare — centru de suport premium, 16 noiembrie 2026

## Separarea de AutoCare AI

Centrul de suport conține exclusiv conversații cu echipa. Au fost eliminate componentele de generare AI din chatul clientului și al operatorului. Secțiunea AutoCare AI și istoricul ei nu sunt modificate. API-urile vechi de propuneri AI rămân pentru compatibilitate, dar noua interfață de suport nu le apelează și nu transmite mesajele de suport furnizorului AI.

## Interfață

- Temă navy, accente albastre/mov, carduri compacte, avatar din inițialele reale ale clientului, nume, ultimul mesaj și data/ora lui, număr necitite și status.
- Previzualizarea listei folosește ultimul mesaj non-sistem, nu doar titlul inițial. Anunțurile de atribuire nu înlocuiesc acest mesaj.
- Căutare după nume/email/mesaj pe server; filtre locale pentru necitite, prioritate și responsabil; foldere active, finalizate și coș.
- Bule cu lățime după conținut, text lizibil, data/ora și indicator de citire numai când există confirmarea reală a destinatarului.
- Editor separat de zona care derulează, Enter trimite, Shift+Enter păstrează rândul nou și nu trimite. Dimensionarea panoului urmărește visualViewport pentru tastatura mobilă. Fișierele PDF/JPEG/PNG folosesc endpointul existent și limita de 2 MB.
- Pe mobil, lista și conversația sunt ecrane alternative, cu întoarcere la listă. Profilul se deschide ca panou lateral, cu fundal de închidere și Escape.

## Profil și operațiuni

- Nume, email, data înregistrării, status cont, responsabil, abonament și vehicule active cu marcă/model, număr de înmatriculare, an și kilometraj. Nu se expun VIN-uri sau date ale altor clienți.
- Ultima activitate este etichetată explicit ca activitate de sesiune, din timestamp-ul disponibil. Dacă nu există date, apare Nedisponibilă; nu se inventează un status online.
- Preluarea, transferul, prioritățile, statusul în lucru/în așteptare, finalizarea, redeschiderea, coșul recuperabil și restaurarea păstrează autorizarea existentă.
- Notele interne au editor și avertizare că sunt vizibile doar echipei; nu apar în conversația clientului.
- Ștergerea din interfață înseamnă mutare în coș cu confirmare, fără ștergere definitivă a conversațiilor.

## Statistici

Pagină separată în centrul de suport: solicitări noi (active și neatribuite), toate activele (includ solicitările noi), finalizate în prezent, primul răspuns mediu, rezolvare medie, necitite și satisfacție din evaluări. Activitatea echipei afișează numărul mesajelor din ultimele 7 zile; nu este prezentată ca evaluare presupusă a calității. Evoluția pe 14 zile folosește date UTC și include explicit zilele cu zero solicitări.

Corecție de calcul: totalul finalizatelor folosește statusul curent completed, astfel încât o conversație redeschisă să nu rămână numărată ca finalizată.

## Notificări

Actualizarea existentă la 4 secunde este păstrată pentru secțiunea vizibilă și conexiune disponibilă. Mesajele noi declanșează o alertă în aplicație și, dacă utilizatorul permite, notificare de browser. Funcționează pentru client și operator; operatorii sunt alertați pentru solicitările neatribuite sau atribuite lor. Se urmărește identificatorul ultimului mesaj real, pentru a evita alertele provocate doar de schimbarea statusului sau de propriul mesaj.

Aceasta este actualizare periodică în prim-plan, nu un serviciu nou WebSocket și nu o garanție de push cu aplicația închisă. Cererea permisiunii de browser rămâne la apăsarea butonului de către utilizator. Conținutul privat al mesajului nu este inclus în notificarea de sistem.

## Protecție și verificări

Backup cod înainte de lucru: `backup/pre-support-premium-2026-11-16`.
Nu s-au schimbat roluri, permisiuni, prețuri, abonamente sau schema bazei de date. Nu au fost șterse sau create conversații demonstrative în producție.

- Lint, TypeScript și build de producție trecute.
- Suita include testele existente pentru trimitere, istoric, paginare, transfer, atașamente private, note interne, status, coș/restaurare, citire și refuzul accesului între conturi.
- Teste noi: ultimul mesaj real după un anunț de sistem, vehiculele unui singur client, statistici zilnice reconciliate cu baza și totalul finalizatelor după redeschidere.
- Testul React verifică experiențe distincte pentru client și echipă, fără controale AI; chatul auto rămâne separat.
- Scriptul `scripts/audit/support-dom-check.mts` testează componentele reale în DOM izolat, cu API simulat: căutare, prioritate, navigare mobilă înainte/înapoi, preluare, Enter/Shift+Enter, profil, note, atașare, finalizare, redeschidere, confirmare coș, restaurare, notificări pentru operator și client, statistici și transfer. Dependența JSDOM de test este externă proiectului; nu s-a adăugat o dependență de producție.

## Limite

Testele DOM nu măsoară aspectul CSS, suprapunerile, tastatura Android/iOS sau notificările reale de sistem. Accesul browserului conectat și previzualizarea locală nu sunt disponibile în mediul curent, conform încercărilor din intervenția precedentă; nu pretind verificare vizuală pe dispozitive reale. Nu au fost trimise mesaje de probă către clienți în producție.

Rezultatul exact al suitei finale și verificarea Render se adaugă după publicare.

## Rezultat publicare

- **284/284 teste trecute**, 0 eșecuri; **15 scenarii DOM trecute**, cu 95 de cereri către API-ul local simulat. Lint și build trecute.
- Render LIVE: `dep-dbtae1dg1s2s7398gnag`, commit aplicație `6c9562523db03a2ba88a3ef24d9086c6324f0851`. `/api/app-version` confirmă versiunea.
- Pagina centrului de suport redirecționează vizitatorul neautentificat către autentificare, păstrând destinația. Răspunsul este privat și nu se salvează în cache partajat.
- Lista conversațiilor, statisticile, lista echipei și profilul clientului răspund HTTP 401 fără sesiune.
- Logurile de nivel error nu au returnat intrări în intervalul verificat după activarea deploy-ului. Aceasta nu reprezintă monitorizare permanentă sau certificare a tuturor fluxurilor de producție.
- Nu s-a schimbat planul Render Free și nu s-au activat costuri noi.
