export const revalidate = 30;
export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_AUTOCARE_BUILD || 'development' },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' } },
  );
}
