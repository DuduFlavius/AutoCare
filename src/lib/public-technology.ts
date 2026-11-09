export const technologyPages = {
  'smart-gps': {
    label: 'Smart GPS',
    title: 'Înregistrează drumurile cu Smart GPS',
    intro:
      'Pornește urmărirea, vezi traseul pe hartă și salvează distanța și durata pentru mașina aleasă.',
    action: 'Deschide SmartDrive',
    workspace: '/cont?tab=Plan%20%C3%AEntre%C8%9Binere',
    sections: [
      [
        'Alege mașina înainte de plecare',
        'SmartDrive înregistrează călătoria pentru mașina selectată. În browser, acordă permisiunea de localizare și păstrează aplicația deschisă. Înregistrarea în fundal necesită aplicația nativă și permisiunile sistemului.',
      ],
      [
        'Sincronizează distanța cu kilometrajul',
        'Poți adăuga distanța GPS la kilometraj atunci când salvezi. AutoCare validează punctele, exclude golurile de semnal și folosește un identificator al călătoriei pentru ca o reîncercare să nu adauge aceiași kilometri de două ori.',
      ],
      [
        'Consultă călătoriile anterioare',
        'Distanța, durata și statisticile călătoriilor rămân asociate mașinii în cont. Harta traseului este disponibilă pe dispozitivul care a înregistrat coordonatele, dacă arhiva locală există.',
      ],
    ],
  },
  bluetooth: {
    label: 'Bluetooth auto',
    title: 'Pornește SmartDrive cu Bluetooth-ul mașinii',
    intro:
      'Pe Android, un sistem audio auto compatibil, asociat explicit cu o mașină, poate declanșa monitorizarea GPS.',
    action: 'Deschide SmartDrive',
    workspace: '/cont?tab=Plan%20%C3%AEntre%C8%9Binere&drive=bluetooth',
    sections: [
      [
        'Asociază sistemul audio al mașinii',
        'Alege vehiculul în AutoCare și aprobă asocierea cu sistemul audio auto raportat de Android. Conexiunea activă și mișcarea susținută sunt verificate înainte de înregistrare. Cu APK-ul actualizat poți verifica starea conexiunii și deschide setările Android pentru reconectare.',
      ],
      [
        'Acordă permisiunile Android',
        'Pornirea automată necesită aplicația nativă actualizată, locație precisă în fundal și acces la Bluetooth. Căștile, boxele și dispozitivele fără clasă auto nu pot fi alese.',
      ],
      [
        'Pe iPhone și în browser',
        'Folosește pornirea manuală GPS. Identificarea sistemului Bluetooth auto și citirea directă a datelor OBD nu sunt disponibile în aceste interfețe.',
      ],
    ],
  },
  'smart-maintenance': {
    label: 'Smart Maintenance',
    title: 'Planifică uleiul, distribuția și reviziile',
    intro:
      'Consultă istoricul de service și vezi cât timp sau câți kilometri au rămas până la următoarea lucrare.',
    action: 'Deschide întreținerea',
    workspace: '/cont?tab=%C3%8Entre%C8%9Binere',
    sections: [
      [
        'Completează intervalul mașinii tale',
        'Salvează data și kilometrajul lucrării, apoi introdu intervalul sau termenul recomandat pentru modelul și motorul tău. Poți urmări separat uleiul, distribuția și alte operațiuni.',
      ],
      [
        'Actualizează kilometrajul',
        'O citire manuală sau sincronizarea unei călătorii GPS actualizează kilometrii rămași. Când ai și un termen calendaristic, urmărește limita care vine prima.',
      ],
      [
        'Primește mementouri și păstrează istoricul',
        'Consultă termenele și înregistrează intervenția când lucrarea a fost efectuată. Notificările depind de canalul și permisiunile configurate în cont.',
      ],
    ],
  },
  'autocare-maps': {
    label: 'AutoCare Maps',
    title: 'Vezi traseele și punctele de interes auto',
    intro:
      'Explorează o hartă întunecată cu trasee GPS și caută service-uri, benzinării, parcări sau stații de încărcare.',
    action: 'Deschide AutoCare Maps',
    workspace: '/cont?tab=Plan%20%C3%AEntre%C8%9Binere&drive=points',
    sections: [
      [
        'Vezi poziția și traseul',
        'În timpul înregistrării, harta urmărește poziția disponibilă prin GPS și poate fi deschisă pe tot ecranul. În istoric poți alege mașina și data și poți vedea plecarea și sosirea dacă traseul este disponibil pe dispozitiv.',
      ],
      [
        'Caută în zona afișată',
        'Mută harta sau centreaz-o pe poziția ta, alege categoria și pornește căutarea. Rezultatele provin din OpenStreetMap și reflectă informațiile cartografiate în acea zonă.',
      ],
      [
        'Deschide destinația în Google Maps',
        'Selectează un rezultat pentru a deschide indicațiile de orientare. Disponibilitatea parcărilor, prețurile și starea stațiilor de încărcare se verifică la operator.',
      ],
    ],
  },
} as const;
