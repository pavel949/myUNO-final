import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAccountProfile, updateAccountProfile } from '@/modules/core';
import { handleError } from '@/app/libs/errorHandler';

/**
 * A person's own profile. Scoped to the session and nothing else — there is no
 * identity parameter, so this cannot be pointed at somebody else's account.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const profile = await getAccountProfile(prisma, user.identityId);
    if (!profile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    await updateAccountProfile(prisma, user.identityId, {
      firstName: body.firstName,
      lastName: body.lastName,
      preferredLocale: body.preferredLocale,
    });
    return NextResponse.json({ profile: await getAccountProfile(prisma, user.identityId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update the profile' },
      { status: 400 }
    );
  }
}
