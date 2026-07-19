import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getProviderForIdentity } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * GET /api/provider/me — the caller's provider: their membership's provider,
 * or their own latest application (so applicants can watch vetting status).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }
    const provider = await getProviderForIdentity(prisma, user.identityId);
    if (!provider) {
      throw createPublicError('not found', 404);
    }
    return NextResponse.json({ provider });
  } catch (error) {
    return handleError(error);
  }
}
