'use server';

import { getSessionUser } from '@/lib/session';

export type { CurrentUser } from '@/lib/session';

/**
 * Extract the current user from the signed session cookie.
 *
 * The implementation lives in `@/lib/session` so it can be wrapped in React's
 * `cache()` — a `'use server'` module may only export async functions. Every
 * existing call site keeps working unchanged; they now share one query per
 * request instead of one query each.
 */
export async function getCurrentUser() {
  return getSessionUser();
}
