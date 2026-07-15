import { NextRequest, NextResponse } from 'next/server';
import {
  register,
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/modules/auth';
import { checkRateLimit } from '@/app/libs/rateLimit';


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
    const { firstName, lastName, email, password, locale = 'en' } = body;

    // Validate input
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const ipLimit = checkRateLimit(`register:ip:${clientIp(request)}`);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((ipLimit.retryAfterMs || 0) / 1000)) } }
      );
    }

    const identity = await register({
      firstName,
      lastName,
      email,
      password,
      locale,
    });

    const response = NextResponse.json(
      {
        id: identity.id,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        message: 'Registration successful. Please check your email to verify.',
      },
      { status: 201 }
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

    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
