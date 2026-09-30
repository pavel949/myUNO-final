import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { removeSavedEntry } from '@/modules/browse';
import { handleError } from '@/app/libs/errorHandler';

export const dynamic = 'force-dynamic';

/** Remove exactly one saved-list entry; its owner is derived from the session. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!params.id) {
      return NextResponse.json({ error: 'Missing saved entry' }, { status: 400 });
    }
    const result = await removeSavedEntry(prisma, user.identityId, params.id);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
