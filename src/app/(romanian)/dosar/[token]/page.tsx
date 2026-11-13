import { readMechanicShare } from '@/lib/mechanic-shares';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Dosar mecanic · AutoCare',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function MechanicFolder({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let share;
  try {
    share = await readMechanicShare(token);
  } catch {
    return (
      <main className="ac-shared-folder ac-editorial-hero">
        <h1>Dosar indisponibil / Unavailable</h1>
        <p>
          Linkul a expirat sau accesul a fost revocat. / The link expired or access was revoked.
        </p>
      </main>
    );
  }
  return (
    <main className="ac-shared-folder">
      <header className="ac-editorial-hero">
      <p className="eyebrow">AUTOCARE · DOSAR MECANIC / MECHANIC FOLDER</p>
      <h1>{share.snapshot.vehicle}</h1>
      <p>
        Acces doar pentru citire / Read-only · Expiră / Expires:{' '}
        {share.expiresAt.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}
      </p>
      <p>Informații selectate de proprietar. / Information selected by the owner.</p>
      </header>
      {share.snapshot.records.map((r) => (
        <article className="card" key={r.id}>
          <h2>{r.title}</h2>
          <p>
            {r.category} · {r.date || '—'} · {r.odometer?.toLocaleString('ro-RO') ?? '—'} km
          </p>
          {r.amountBani !== undefined && <p>{(r.amountBani / 100).toFixed(2)} RON</p>}
        </article>
      ))}
      {share.snapshot.files.length > 0 && (
        <section className="card">
          <h2>Documente / Documents</h2>
          {share.snapshot.files.map((f) => (
            <p key={f.id}>
              <a rel="noreferrer" href={'/api/dosar/' + token + '/files/' + f.id}>
                {f.name} ↓
              </a>
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
