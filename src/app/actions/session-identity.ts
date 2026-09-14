import { getCurrentUser } from './getCurrentUser';

/**
 * The caller's own identity, from the session.
 *
 * Every file under `src/app/actions/` carries `'use server'`, which makes each
 * export a callable RPC endpoint — not merely a function that server
 * components import. Any argument such an export accepts is therefore
 * attacker-controlled, including an identity id.
 *
 * The services behind these actions scope correctly *relationally* — units by
 * `ownerIdentityId`, an MC by its role assignment, a booking by its guest —
 * but none of them can know whether that identity is the person calling. That
 * check belongs here, and nowhere else: an action that takes an identity as a
 * parameter is asking the caller to assert who they are.
 *
 * So actions resolve the identity from the session instead. Legitimate callers
 * are unaffected — every one of them was already passing `user.identityId`
 * from the same session.
 */
export async function requireSessionIdentityId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user.identityId;
}
