import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { requestAccountDeletion, cancelAccountDeletion } from '@/modules/core';

export const dynamic = 'force-dynamic';

/** Starts the PDPA deletion grace period on the caller's own account (doc 12 §2). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await requestAccountDeletion(prisma, user.identityId);
    return NextResponse.json({ requested: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not request deletion' },
      { status: 400 }
    );
  }
}

/** Cancels a pending deletion request, only while still inside the grace period. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await cancelAccountDeletion(prisma, user.identityId);
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not cancel deletion' },
      { status: 400 }
    );
  }
}
