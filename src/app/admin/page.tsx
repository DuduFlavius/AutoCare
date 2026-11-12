import AdminLocale from '@/components/admin-locale';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireFounder, founderOverview } from '@/lib/founder';
import MailCenter from '@/components/mail-center';
import { requireMailStaff } from '@/lib/mail-center';
import FounderPanel from '@/components/founder-panel';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panou Fondator', robots: { index: false, follow: false } };
export default async function FounderPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (
    !session?.user ||
    (process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true' && !session.user.emailVerified)
  )
    redirect('/autentificare');
  try {
    const actor = await requireMailStaff(session.user.id);
    if (actor.role !== 'founder') return <AdminLocale><main className="founder-shell mail-staff-shell"><a className="button" href="/cont">Înapoi în garaj</a><MailCenter /></main></AdminLocale>;
    await requireFounder(session.user.id);
  } catch {
    return (
      <main className="founder-access-denied">
        <h1>Acces rezervat Fondatorului.</h1>
        <p>Acest cont nu are acces la panoul platformei.</p>
        <a className="button primary" href="/cont">
          Înapoi în garaj
        </a>
      </main>
    );
  }
  return <AdminLocale><FounderPanel initial={await founderOverview(session.user.id)} name={session.user.name} /></AdminLocale>;
}
