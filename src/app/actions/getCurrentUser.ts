'use server';

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

// Extract the current user from the signed session cookie.
// The cookie is set by /api/auth/login and /api/auth/register and is
// HMAC-signed — a tampered or expired token verifies to null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}
