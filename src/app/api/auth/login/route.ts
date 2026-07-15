import { NextRequest, NextResponse } from 'next/server';
import {
  login,
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/modules/auth';
import { checkRateLimit, resetRateLimit } from '@/app/libs/rateLimit';


function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    const ipKey = `login:ip:${clientIp(request)}`;
    const accountKey = `login:acct:${String(email).toLowerCase()}`;
    const ipLimit = checkRateLimit(ipKey);
    const acctLimit = checkRateLimit(accountKey);
    if (!ipLimit.allowed || !acctLimit.allowed) {
      const retryAfterMs = Math.max(ipLimit.retryAfterMs || 0, acctLimit.retryAfterMs || 0);
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const identity = await login({ email, password });
    resetRateLimit(accountKey);

    const response = NextResponse.json(
      {
        id: identity.id,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        emailVerified: !!identity.emailVerifiedAt,
      },
      { status: 200 }
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSessionToken(identity.id),
      sessionCookieOptions()
    );
    return response;
  } catch (error) {
    if (error instanceof Error && 'code' in error && 'statusCode' in error) {
      const authError = error as any;
      return NextResponse.json(
        { error: error.message, code: authError.code },
        { status: authError.statusCode }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
