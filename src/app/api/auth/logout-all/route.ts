import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { revokeAllSessions } from '@/modules/core';
import { sessionCookieOptions, SESSION_COOKIE_NAME } from '@/modules/auth';

export const dynamic = 'force-dynamic';

/** "Log out everywhere": every session of this identity ends, this one included. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user?.identityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await revokeAllSessions(prisma, user.identityId);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(0));
  return response;
}
