import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await auth().api.getSession({ headers: request.headers });
    const allowed = session?.user?.email?.trim().toLowerCase() === 'flaviusdudu4@gmail.com';
    return NextResponse.json({ allowed }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ allowed: false }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
