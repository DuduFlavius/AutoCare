import {after} from 'next/server';
import {dispatchMailSafely} from '@/lib/mail-dispatch';
import { authHandlers } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  const response = await authHandlers().GET(req);
  if (response.status < 400 && new URL(req.url).pathname.endsWith('/verify-email')) after(async()=>{await dispatchMailSafely();});
  return response;
}
export async function POST(req: Request) {
  const response=await authHandlers().POST(req);
  if(response.ok&&/\/(sign-up\/email|email-otp\/verify-email)$/.test(new URL(req.url).pathname))after(async()=>{await dispatchMailSafely();});
  return response;
}
