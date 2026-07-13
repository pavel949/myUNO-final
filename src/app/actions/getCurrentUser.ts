'use server';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Extract the current user from the session cookie
// Session format: a simple header with the identity ID
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    // Look for a session token in cookies (format: user-id:timestamp:signature)
    // For now, we'll look for a simple X-User-ID header equivalent stored in a cookie
    const sessionToken = cookieStore.get('auth-session')?.value;

    if (!sessionToken) {
      return null;
    }

    // Parse the token to extract identity ID
    // Format: identityId (for development; in production use JWT)
    const identityId = sessionToken;

    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
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
    };
  } catch (error) {
    return null;
  }
}
