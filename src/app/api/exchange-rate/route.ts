import { latestExchangeRate } from '@/lib/exchange-rate-server';

export async function GET() {
  const rate = await latestExchangeRate();
  return Response.json(rate, {
    status: rate ? 200 : 503,
    headers: { 'Cache-Control': rate ? 'public, max-age=300, s-maxage=900' : 'no-store' },
  });
}
