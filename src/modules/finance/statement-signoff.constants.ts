import type { OwnerStatementStatus } from '@prisma/client';

/**
 * Statement lifecycle constants shared by server services and client UI.
 *
 * Keep this module browser-safe: no Prisma client instance, Node built-ins,
 * server actions, or server-only module imports belong here.
 */
export const OWNER_VISIBLE_STATEMENT_STATUSES: OwnerStatementStatus[] = [
  'published',
  'pending_owner_review',
  'signed_off',
  'distributed',
  'superseded',
];

export const SIGNABLE_STATEMENT_STATUSES: OwnerStatementStatus[] = [
  'draft',
  'published',
  'pending_owner_review',
];

export function isOwnerVisibleStatementStatus(
  status: OwnerStatementStatus
): boolean {
  return OWNER_VISIBLE_STATEMENT_STATUSES.includes(status);
}

export function isSignableStatementStatus(
  status: OwnerStatementStatus
): boolean {
  return SIGNABLE_STATEMENT_STATUSES.includes(status);
}
