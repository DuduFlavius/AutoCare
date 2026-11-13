import {after} from 'next/server';
import {dispatchMailSafely} from '@/lib/mail-dispatch';
import { authHandlers } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  return authHandlers().GET(req);
}
export async function POST(req: Request) {
  const response=await authHandlers().POST(req);
  if(response.ok&&new URL(req.url).pathname.endsWith('/sign-up/email'))after(async()=>{await dispatchMailSafely();});
  return response;
}
