import { authHandlers } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  return authHandlers().GET(req);
}
export async function POST(req: Request) {
  return authHandlers().POST(req);
}
