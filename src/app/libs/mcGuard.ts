import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createPublicError } from '@/app/libs/errorHandler';
import { getMCProjectScopes } from '@/app/libs/projectScope';

/**
 * Resolve the caller's MC membership for a specific project + organization scope.
 * The scope comes from query params — never from the request body.
 */
export async function requireMcMember(input: {
  projectId: string;
  organizationId: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw createPublicError('unauthorized', 401);
  }

  const scopes = getMCProjectScopes(user);
  const match = scopes.find(
    (scope) =>
      scope.projectId === input.projectId &&
      scope.organizationId === input.organizationId
  );

  if (!match) {
    throw createPublicError('forbidden', 403);
  }

  return { user, projectId: match.projectId, organizationId: match.organizationId };
}
