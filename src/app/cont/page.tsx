import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Dashboard from '@/components/dashboard';
import { PublicShell } from '@/components/public-shell';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Garajul meu', robots: { index: false, follow: false } };
export default async function Account() {
  let sess;
  try {
    sess = await auth().api.getSession({ headers: await headers() });
  } catch {
    return (
      <PublicShell>
        <main className="content-page">
          <h1>Configurarea este necesară.</h1>
          <p>
            Conectează baza de date, autentificarea și serviciul de email conform instrucțiunilor
            proiectului. Conturile nu sunt simulate.
          </p>
        </main>
      </PublicShell>
    );
  }
  if (
    !sess?.user ||
    (process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true' && !sess.user.emailVerified)
  )
    redirect('/autentificare');
  return <Dashboard name={sess.user.name} />;
}
