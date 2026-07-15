import { NextResponse } from 'next/server';
import { sessionCookieOptions, SESSION_COOKIE_NAME } from '@/modules/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(0));
  return response;
}
