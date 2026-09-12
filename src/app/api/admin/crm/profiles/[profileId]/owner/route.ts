import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { failed, requireAdmin } from '@/app/libs/onboardingGuard';
import { setCrmAccountOwner } from '@/modules/crm/account-ownership.service';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { profileId: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    const rawOwnerId = body?.accountOwnerIdentityId;
    const accountOwnerIdentityId =
      rawOwnerId === null || rawOwnerId === '' ? null : String(rawOwnerId || '').trim();

    if (rawOwnerId !== null && rawOwnerId !== '' && !accountOwnerIdentityId) {
      return NextResponse.json({ error: 'accountOwnerIdentityId is required' }, { status: 400 });
    }

    const profile = await setCrmAccountOwner(prisma, {
      profileId: params.profileId,
      accountOwnerIdentityId,
      changedByIdentityId: guard.actorIdentityId,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return failed(error, 'Unable to update account owner');
  }
}
