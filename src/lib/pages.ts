import { publicTopics } from './seo';
export const pages: Record<
  string,
  { title: string; intro: string; sections: Array<[string, string]> }
> = {
  ...Object.fromEntries(
    Object.entries(publicTopics).map(([key, value]) => [
      key,
      { ...value, sections: value.sections.map(([a, b]) => [a, b] as [string, string]) },
    ]),
  ),
  functionalitati: {
    title: 'Un loc pentru tot ce ține de mașina ta',
    intro: 'Construiește un istoric pe care îl poți consulta oricând, direct de pe telefon.',
    sections: [
      [
        'Garaj digital',
        'Adaugă marca, modelul, numărul de înmatriculare și kilometrajul. Datele mașinii sunt private.',
      ],
      [
        'Documente și expirări',
        'Păstrează RCA, CASCO, ITP, rovinieta și documentele personalizate. Datele sunt introduse de tine și nu reprezintă o verificare oficială.',
      ],
      [
        'Întreținere și costuri',
        'Înregistrează revizii, reparații, piese și cheltuieli. Kilometrajul se actualizează manual. Intervalele de service sunt cele recomandate pentru mașina ta.',
      ],
      [
        'Alerte configurabile',
        'Primești mementouri prin email sau Web Push compatibil. Livrarea depinde de serviciile configurate, permisiunile dispozitivului și disponibilitatea rețelei.',
      ],
    ],
  },
  'cum-functioneaza': {
    title: 'De la cont la primul memento',
    intro: 'Câțiva pași simpli pentru un garaj organizat.',
    sections: [
      [
        '01. Creează contul',
        'Folosește o adresă de e-mail validă și alege o parolă de minimum 12 caractere. Confirmă adresa dacă primești o cerere de verificare.',
      ],
      [
        '02. Adaugă mașina',
        'Completează detaliile și kilometrajul actual. Planul gratuit permite o mașină activă.',
      ],
      [
        '03. Completează scadențele',
        'Adaugă documentele și verifică atent datele de expirare. Poți atașa PDF-uri sau imagini în limitele planului.',
      ],
      [
        '04. Alege alertele',
        'Configurează fusul orar și intervalele disponibile. Consultă istoricul notificărilor pentru statusul fiecărei trimiteri.',
      ],
    ],
  },
  'intrebari-frecvente': {
    title: 'Răspunsuri înainte să pornești',
    intro: 'Ce trebuie să știi despre cont, date și notificări.',
    sections: [
      [
        'Se citesc automat datele mașinii?',
        'Nu. Kilometrajul și datele documentelor sunt introduse de utilizator. Nu există o conexiune cu registrele oficiale sau cu vehiculul.',
      ],
      [
        'Pot primi notificări pe iPhone?',
        'Web Push depinde de browser și sistem. Pe iOS este necesară, în general, instalarea aplicației web pe ecranul principal și acordarea permisiunii. Nu toate browserele sau dispozitivele oferă aceleași funcții.',
      ],
      [
        'Îmi sunt documentele publice?',
        'Nu. Atașamentele și datele din garaj sunt accesibile numai după autentificare și verificarea proprietarului pe server.',
      ],
      [
        'Ce se întâmplă dacă renunț la Premium?',
        'Nu ștergem automat istoricul. Funcțiile Premium se dezactivează și adăugarea mașinilor este limitată. Poți exporta gratuit datele personale în JSON.',
      ],
      [
        'Pot plăti acum?',
        'Această versiune permite numai integrarea Stripe în mediul de testare. Încasările reale sunt dezactivate.',
      ],
    ],
  },
  contact: {
    title: 'Suntem aici pentru întrebările tale',
    intro:
      'Pentru o solicitare legată de cont, folosește formularul de suport din zona Setări, după autentificare.',
    sections: [
      [
        'Suport în aplicație',
        'Mesajul tău este salvat și poate fi consultat de administrator. Nu include parole, date de card sau documente sensibile în mesaj.',
      ],
      [
        'Înainte de lansare',
        'Datele operatorului comercial, adresa de contact și termenele de răspuns trebuie completate înainte de deschiderea serviciului public.',
      ],
    ],
  },
  confidentialitate: {
    title: 'Politica de confidențialitate — proiect',
    intro:
      'Document de lucru pentru verificare juridică. Operatorul, datele de contact și temeiurile exacte trebuie completate înainte de lansarea comercială.',
    sections: [
      [
        'Ce date prelucrăm',
        'Date de cont, email, datele mașinilor, documente, cheltuieli, preferințe și jurnalul tehnic necesar funcționării. Scopurile sunt furnizarea serviciului, securitatea și gestionarea abonamentului. Temeiurile și evaluarea interesului legitim vor fi confirmate juridic.',
      ],
      [
        'Furnizori și transferuri',
        'Hostingul, baza de date, emailul și plățile implică furnizori externi. Selectează regiunea UE unde este disponibilă și verifică acordurile de prelucrare, subcontractanții și eventualele transferuri internaționale înainte de lansare.',
      ],
      [
        'Retenție și ștergere',
        'Datele contului și fișierele asociate se șterg din baza activă la ștergerea contului. Copiile de siguranță expiră conform politicii operaționale. Obligațiile fiscale pot impune păstrarea separată a anumitor date; acest flux trebuie aprobat înainte de plăți reale.',
      ],
      [
        'Drepturile tale',
        'Poți descărca datele personale din Setări și solicita ștergerea contului. Ai drepturile aplicabile de acces, rectificare, restricționare, opoziție și plângere către ANSPDCP. Datele operatorului și canalul de contact trebuie completate.',
      ],
    ],
  },
  termeni: {
    title: 'Termeni și condiții — proiect',
    intro:
      'Proiect supus verificării juridice. Nu este pregătit pentru lansare comercială fără completarea operatorului și a condițiilor contractuale.',
    sections: [
      [
        'Natura serviciului',
        'AutoCare este un instrument de organizare. Nu validează oficial documentele, nu oferă asigurări și nu înlocuiește obligația de a urmări termenele și starea tehnică a vehiculului.',
      ],
      [
        'Corectitudinea datelor',
        'Utilizatorul verifică datele introduse. Livrarea alertelor poate fi afectată de furnizorul email, browser, rețea sau permisiuni. Limitele rezonabile de răspundere trebuie verificate juridic.',
      ],
      [
        'Abonamente și retragere',
        'Prețurile sunt ipoteze de test. Checkout-ul real este blocat. Înainte de vânzare trebuie precizate TVA, facturarea, reînnoirea, anularea, rambursarea, dreptul de retragere și procedura de reclamații pentru consumatori.',
      ],
      [
        'Contul tău',
        'Folosește o parolă unică. Accesul neautorizat și încărcarea conținutului ilegal sunt interzise. Datele pot fi exportate din cont.',
      ],
    ],
  },
  'cookie-uri': {
    title: 'Cookie-uri și stocare locală',
    intro:
      'Versiunea curentă folosește numai funcțiile necesare autentificării și instalării aplicației.',
    sections: [
      [
        'Cookie-uri necesare',
        'Sesiunea de autentificare utilizează cookie-uri protejate, cu o durată controlată de sistemul de autentificare. Acestea sunt necesare accesului privat și securității.',
      ],
      [
        'Fără analiză sau marketing',
        'Nu sunt instalate module de publicitate sau analiză. Dacă sunt adăugate ulterior, evaluarea și mecanismul de consimțământ trebuie actualizate înainte de activare.',
      ],
      [
        'Preferințele browserului',
        'Poți șterge cookie-urile din browser. Ștergerea sesiunii te va deconecta. Permisiunile push pot fi retrase din browser și din Setări.',
      ],
    ],
  },
};
