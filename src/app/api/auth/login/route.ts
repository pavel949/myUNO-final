import { NextRequest, NextResponse } from 'next/server';
import {
  login,
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/modules/auth';

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

    const identity = await login({ email, password });

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
