import { NextRequest, NextResponse } from 'next/server';
import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/app/libs/rateLimit';

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Self-serve "claim your existing account" (register page, board 18).
 * Mirrors /api/auth/forgot-password exactly: rate-limited, and always
 * returns success so the response can never confirm whether the email
 * exists or is eligible (core.requestAccountClaim only actually emails an
 * `invited` identity — anything else is a silent no-op).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const ipLimit = checkRateLimit(`claim:ip:${clientIp(request)}`);
    const acctLimit = checkRateLimit(`claim:acct:${String(email).toLowerCase()}`);
    if (!ipLimit.allowed || !acctLimit.allowed) {
      const retryAfterMs = Math.max(ipLimit.retryAfterMs || 0, acctLimit.retryAfterMs || 0);
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    await people.requestAccountClaim(prisma, { email });

    return NextResponse.json(
      { success: true, message: 'If that email has a stay with us, a claim link has been sent' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Account claim request error:', error);
    return NextResponse.json(
      { success: true, message: 'If that email has a stay with us, a claim link has been sent' },
      { status: 200 }
    );
  }
}
