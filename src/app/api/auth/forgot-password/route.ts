import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/modules/auth';
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
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    const ipLimit = checkRateLimit(`reset:ip:${clientIp(request)}`);
    const acctLimit = checkRateLimit(`reset:acct:${String(email).toLowerCase()}`);
    if (!ipLimit.allowed || !acctLimit.allowed) {
      const retryAfterMs = Math.max(ipLimit.retryAfterMs || 0, acctLimit.retryAfterMs || 0);
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    // Always return success to not leak email existence
    await requestPasswordReset({ email });

    return NextResponse.json(
      { success: true, message: 'If an account exists, a reset link has been sent' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { success: true, message: 'If an account exists, a reset link has been sent' },
      { status: 200 }
    );
  }
}
