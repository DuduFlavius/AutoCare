import { readMechanicFile } from '@/lib/mechanic-shares';
export const dynamic = 'force-dynamic';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  try {
    const f = await readMechanicFile(token, id);
    return new Response(Buffer.from(f.data, 'base64'), {
      headers: {
        'Content-Type': f.mime,
        'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new Response('Unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
}
