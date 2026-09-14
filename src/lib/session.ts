import { cache } from 'react';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/modules/auth';

export interface CurrentUser {
  identityId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  roles: {
    role: string;
    projectId: string | null;
    unitId: string | null;
    organizationId: string | null;
    providerId: string | null;
  }[];
}

/**
 * The signed-in identity for this request, resolved at most once.
 *
 * `cache()` memoises per request: the root layout, a portal layout and the
 * page itself all call this while rendering one page, and each call used to be
 * its own identity+roles query. Deduping is invisible to callers and cannot go
 * stale — the memo lives and dies with the request.
 *
 * Kept out of `app/actions/getCurrentUser.ts` because that file is a
 * `'use server'` module, whose exports must all be plain async functions.
 */
export const getSessionUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return null;
    }

    const session = verifySessionToken(sessionToken);
    if (!session) {
      return null;
    }

    const identity = await prisma.identity.findUnique({
      where: { id: session.identityId },
      include: {
        roleAssignments: {
          where: { status: 'active' },
          select: {
            role: true,
            projectId: true,
            unitId: true,
            organizationId: true,
            providerId: true,
          },
        },
      },
    });

    if (!identity || identity.status === 'blocked') {
      return null;
    }

    return {
      identityId: identity.id,
      email: identity.email,
      firstName: identity.firstName,
      lastName: identity.lastName,
      isAdmin: identity.isAdmin,
      roles: identity.roleAssignments,
    };
  } catch {
    return null;
  }
});
