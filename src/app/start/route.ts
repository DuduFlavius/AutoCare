import { auth } from '@/lib/auth';
import { logoDestination } from '@/lib/navigation';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const session = await auth().api.getSession({ headers: req.headers });
    return new Response(null, {
      status: 307,
      headers: { Location: logoDestination(session), 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return new Response(
      'La verificarea sesiunii a apărut o problemă temporară. Reîncarcă pagina pentru a reîncerca.',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': '3',
        },
      },
    );
  }
}
