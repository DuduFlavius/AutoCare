export const guides = {
  'cum-urmaresti-expirarea-documentelor-auto': {
    title: 'Cum să urmărești expirarea documentelor auto',
    description:
      'Organizează documentele pe mașini, verifică datele originale și configurează mementouri pe dispozitiv. Un flux practic pentru RCA, ITP și rovinietă.',
    related: 'documente-auto',
    sections: [
      [
        'Pornește de la documentul original',
        'Citește data înscrisă în fiecare act și verifică mașina la care se referă. Nu presupune că două documente emise în aceeași zi au aceeași expirare. În AutoCare alegi mașina, tipul documentului și data expirării; completezi seria sau data emiterii numai dacă le cunoști.',
      ],
      [
        'Un dosar pentru fiecare mașină',
        'Păstrează RCA, ITP, rovinieta și celelalte acte la vehiculul corect. O fotografie lizibilă sau un PDF te ajută să verifici ulterior informațiile introduse. Evită să încarci un document în mai multe înregistrări active dacă urmărești aceeași perioadă de valabilitate.',
      ],
      [
        'Alege când vrei să fii avertizat',
        'Configurează intervalele disponibile în abonament și fusul orar. Pentru notificări pe telefon sau calculator, deschide secțiunea Notificări, activează permisiunea și folosește butonul de test. Dacă browserul blochează alertele, schimbă permisiunea în setările site-ului. Pe iPhone ai nevoie de aplicația web adăugată pe ecranul principal.',
      ],
      [
        'Verifică periodic și arhivează ce ai înlocuit',
        'Filtrează documentele care expiră în 30 de zile și verifică mai întâi actele expirate. Când primești un document nou, păstrează vechiul act în arhivă și verifică noua dată. Mementourile sunt un ajutor de organizare; nu înlocuiesc verificarea actelor și nu certifică valabilitatea lor oficială.',
      ],
    ],
  },
  'cum-organizezi-istoricul-de-service': {
    title: 'Cum îți organizezi istoricul de service',
    description:
      'Ce merită să notezi după o revizie sau reparație: data, lucrarea, kilometrajul, costul și documentele atelierului, într-un jurnal coerent.',
    related: 'intretinere-auto',
    sections: [
      [
        'Notează lucrarea cât încă ai detaliile la îndemână',
        'După o vizită la service, creează o operațiune la mașina corectă. Alege categoria, de exemplu schimb ulei, filtre, frâne sau reparație, și data intervenției. Dacă lucrarea nu se potrivește unei categorii, folosește Altă operațiune și o denumire pe care o vei recunoaște.',
      ],
      [
        'Păstrează diferența dintre zero și necunoscut',
        'Introdu costul din factura atelierului când îl ai. Lasă-l necompletat dacă nu îl cunoști; folosește zero numai pentru o operațiune gratuită. Notează kilometrajul de la data lucrării, fără să îl înlocuiești cu o valoare citită mult mai târziu.',
      ],
      [
        'Adaugă dovezi și explicații utile',
        'În Detalii suplimentare poți nota atelierul, piesele și materialele, numărul facturii și observațiile personale. Atașează un fișier acceptat în limita planului. O descriere scurtă, precum piesa înlocuită și motivul intervenției, este mai utilă decât o notă generică de tip revizie.',
      ],
      [
        'Corectează o înregistrare, nu crea încă una',
        'Caută lucrarea înainte de a adăuga aceeași factură a doua oară. Editează costul sau descrierea când primești informații noi. Consultă cronologia și filtrează după categorie pentru a vedea ce ai făcut anterior.',
      ],
      [
        'Planifică folosind recomandările mașinii tale',
        'Păstrează următorul termen sau prag de kilometri când este indicat în documentația producătorului ori stabilit cu atelierul. AutoCare organizează informațiile introduse, fără să stabilească automat un diagnostic tehnic. Un istoric complet te ajută să discuți concret cu mecanicul.',
      ],
    ],
  },
  'cum-tii-evidenta-cheltuielilor-cu-masina': {
    title: 'Cum să ții evidența cheltuielilor cu mașina',
    description:
      'Construiește o evidență auto utilă: categorii consecvente, sume reale și perioade comparabile, fără costuri dublate sau estimări confundate cu plăți.',
    related: 'cheltuieli-auto',
    sections: [
      [
        'Alege un moment simplu de actualizare',
        'Înregistrează cheltuiala după ce ai primit bonul sau factura. Selectează mașina și data, apoi introdu suma în RON. O descriere scurtă și furnizorul te ajută să identifici plata când te întorci la istoric.',
      ],
      [
        'Folosește aceleași categorii în timp',
        'Separă reviziile, reparațiile și celelalte costuri în categoriile disponibile. Pentru lucrări asemănătoare, păstrează aceeași categorie, ca să poți compara perioadele. Dacă folosești mai multe mașini, verifică mereu asocierea înainte de salvare.',
      ],
      [
        'Nu număra de două ori aceeași factură',
        'Când ai înregistrat o operațiune cu cost în jurnalul de întreținere, verifică raportul și datele existente înainte de a adăuga separat aceeași plată. Pentru o corecție, editează înregistrarea inițială. Un total mai mare nu înseamnă neapărat cheltuieli noi; poate indica și un duplicat.',
      ],
      [
        'Compară intervale echivalente',
        'Uită-te la luni complete sau la aceeași perioadă din istoric. O reparație mare într-o lună nu descrie singură costul obișnuit al mașinii. Consultă categoriile și înregistrările din spatele totalului înainte să tragi o concluzie.',
      ],
      [
        'Ține separat ce ai plătit de ce ai în plan',
        'Un deviz sau o estimare pentru o lucrare viitoare nu este o plată efectuată. Păstrează explicațiile în notițe și actualizează suma când cunoști costul real. Graficele AutoCare reflectă datele înregistrate de tine, nu tranzacții importate automat din bancă.',
      ],
    ],
  },
} as const;
