import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createPublicError } from '@/app/libs/errorHandler';

/**
 * Resolve the caller's provider membership for the /api/provider/* routes.
 * The provider a member acts for comes from their active `provider_member`
 * role assignment — never from the request body.
 */
export async function requireProviderMember() {
  const user = await getCurrentUser();
  if (!user) {
    throw createPublicError('unauthorized', 401);
  }
  const providerId = user.roles.find(
    (r) => r.role === 'provider_member' && r.providerId
  )?.providerId;
  if (!providerId) {
    throw createPublicError('forbidden', 403);
  }
  return { user, providerId };
}
