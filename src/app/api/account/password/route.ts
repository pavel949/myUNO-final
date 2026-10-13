import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { changeAccountPassword } from '@/modules/core';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from '@/modules/auth';

/**
 * Change a password, proving the current one. A borrowed session is not enough
 * to lock the real owner out — that is what separates this from the reset flow.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.currentPassword || !body?.newPassword) {
    return NextResponse.json(
      { error: 'Both the current and the new password are required' },
      { status: 400 }
    );
  }

  try {
    await changeAccountPassword(prisma, user.identityId, body.currentPassword, body.newPassword);
    // The change ended every session, this one included; hand the caller a fresh one.
    const response = NextResponse.json({ changed: true });
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user.identityId), sessionCookieOptions());
    return response;
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not change the password' },
      // A wrong current password is a failed authentication, not a malformed
      // request, and saying so lets a client tell the two apart.
      { status: code === 'WRONG_PASSWORD' ? 403 : 400 }
    );
  }
}
