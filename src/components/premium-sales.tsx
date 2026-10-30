'use client';
export default function PremiumSales({
  language,
  attachmentLimit,
}: {
  language: 'ro' | 'en';
  attachmentLimit: number;
}) {
  const en = language === 'en';
  const comparison = [
    [en ? 'Complete service and renew its interval' : 'Finalizează lucrarea și reînnoiește intervalul', '—', en ? 'Included' : 'Inclus'],
    [en ? 'Estimated budget vs actual cost' : 'Buget estimat vs cost real', '—', en ? 'Included' : 'Inclus'],
    [en ? 'Temporary mechanic folder' : 'Dosar temporar pentru mecanic', '—', en ? '1, 3 or 7 days · revocable' : '1, 3 sau 7 zile · revocabil'],
    [en ? 'Active vehicles' : 'Mașini active', '1', en ? 'Unlimited' : 'Nelimitate'],
    [
      en ? 'Basic documents & history' : 'Documente și istoric de bază',
      en ? 'Included' : 'Inclus',
      en ? 'Included' : 'Inclus',
    ],
    [
      en ? 'Mileage and time intervals' : 'Intervale după kilometraj și timp',
      en ? 'Basic history' : 'Istoric de bază',
      en ? 'Configurable per operation' : 'Configurabile pe operațiune',
    ],
    [
      en ? 'Remaining days, km and progress' : 'Zile, km rămași și progres',
      '—',
      en ? 'Included' : 'Inclus',
    ],
    [
      en ? 'Advanced operation reminders' : 'Alerte avansate pe operațiune',
      en ? 'General reminders' : 'Mementouri generale',
      en ? 'Days and custom km thresholds' : 'Zile și praguri km personalizate',
    ],
    [en ? 'PDF and CSV reports' : 'Rapoarte PDF și CSV', '—', en ? 'Included' : 'Incluse'],
    [
      en ? 'Advanced costs and cost per km' : 'Statistici și cost per km',
      '—',
      en ? 'With sufficient readings' : 'Cu date suficiente',
    ],
    [en ? 'Attachments per account' : 'Atașamente în cont', '2', String(attachmentLimit)],
    [
      en ? 'Personal data export' : 'Export date personale JSON',
      en ? 'Included' : 'Inclus',
      en ? 'Included' : 'Inclus',
    ],
  ];
  const faq = [
    [
      en ? 'How many cars can I add?' : 'Câte mașini pot adăuga?',
      en
        ? 'Free includes one active vehicle. Premium has no active vehicle limit in the app. Each vehicle has its own records.'
        : 'Gratuit include o mașină activă. Premium nu are limită de mașini active în aplicație. Fiecare mașină are propriul istoric.',
    ],
    [
      en
        ? 'Does gifted access include the same tools?'
        : 'Accesul oferit de Fondator include aceleași funcții?',
      en
        ? 'Yes. Gifted access unlocks Premium tools until its expiry date, or without expiry when granted that way. It never creates a charge.'
        : 'Da. Accesul acordat de Fondator deblochează instrumentele Premium până la expirare sau fără termen, dacă a fost oferit astfel. Nu generează plăți.',
    ],
    [
      en ? 'How do cancellation and billing work?' : 'Cum funcționează anularea și facturarea?',
      en
        ? 'Paid plans renew for the selected period. Manage cancellation in the billing portal. Confirmed access remains subject to the paid period and payment status.'
        : 'Planurile plătite se reînnoiesc pentru perioada selectată. Anularea se gestionează din portalul de facturare. Accesul confirmat respectă perioada plătită și starea plății.',
    ],
    [
      en ? 'Are reminders guaranteed?' : 'Sunt garantate notificările?',
      en
        ? 'Email requires a verified address and an enabled email channel. Push requires permission and a registered device. The delivery services and scheduled job must be configured.'
        : 'Emailul necesită adresă verificată și canal activat. Push-ul necesită permisiune și dispozitiv înregistrat. Serviciile de trimitere și jobul programat trebuie să fie configurate.',
    ],
    [
      en ? 'Does AutoCare know the real mileage?' : 'AutoCare știe kilometrajul real?',
      en
        ? 'Only the mileage you confirm is used. Estimates need consistent readings or your explicitly entered daily average. Service intervals come from your vehicle’s maintenance plan.'
        : 'Se folosește kilometrajul confirmat de tine. Estimările necesită citiri coerente sau media zilnică introdusă explicit. Intervalele provin din planul de întreținere al mașinii tale.',
    ],
    [
      en
        ? 'What happens to my records when Premium expires?'
        : 'Ce se întâmplă cu datele dacă expiră Premium?',
      en
        ? 'Your saved records are retained. Advanced features are limited according to the current plan; your personal data export remains free.'
        : 'Înregistrările salvate se păstrează. Funcțiile avansate sunt limitate conform planului curent; exportul datelor personale rămâne gratuit.',
    ],
  ];
  return (
    <>
      <section className="ac-premium-sales" data-workspace-ui>
        <p>AUTOCARE PREMIUM</p>
        <h2>
          {en
            ? 'Take care of your car without remembering every service.'
            : 'Ai grijă de mașina ta fără să mai ții minte toate reviziile.'}
        </h2>
        <p>
          {en
            ? 'Plan maintenance by days and kilometers, organize unlimited vehicles and keep documents and costs together.'
            : 'Planifică întreținerea după zile și kilometri, organizează mașini nelimitate și păstrează documentele și cheltuielile la îndemână.'}
        </p>
        <a href="#premium-plans">{en ? 'Choose your plan' : 'Alege planul potrivit'} ↗</a>
        <small>
          {en
            ? 'All Premium plans include the same tools. Only the billing period differs.'
            : 'Toate planurile Premium includ aceleași instrumente. Diferă doar perioada de facturare.'}
        </small>
      </section>
      <section className="card" data-workspace-ui>
        <h3>
          {en
            ? 'Free or Premium? See exactly what you get.'
            : 'Gratuit sau Premium? Vezi exact ce primești.'}
        </h3>
        <div className="ac-premium-comparison" role="table">
          <div role="row">
            <strong>{en ? 'Feature' : 'Funcție'}</strong>
            <strong>{en ? 'Free' : 'Gratuit'}</strong>
            <strong>Premium</strong>
          </div>
          {comparison.map(([title, free, paid]) => (
            <div role="row" key={title}>
              <span>{title}</span>
              <span>{free}</span>
              <span>{paid}</span>
            </div>
          ))}
        </div>
        <p className="micro">
          {en
            ? 'PDF, JPEG and PNG attachments, up to 2 MB each. Synchronization uses your account; downloadable reports are not full attachment backups.'
            : 'Atașamente PDF, JPEG și PNG, de maximum 2 MB fiecare. Sincronizarea folosește contul tău; rapoartele descărcabile nu sunt backupuri complete ale atașamentelor.'}
        </p>
      </section>
      <section className="card ac-premium-faq" data-workspace-ui>
        <h3>{en ? 'Common questions' : 'Întrebări frecvente'}</h3>
        {faq.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </>
  );
}
