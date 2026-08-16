import type { OwnerStatementStatus, Prisma, PrismaClient } from '@prisma/client';

/**
 * Statement sign-off — the one place the two signatures are recorded.
 *
 * A statement carries two signatures: the operator's (myUNO) and the owner's.
 * They are collected through two different doors — `PUT /api/owner/statements/
 * {id}/sign-off` for the owner signing their own statement, and
 * `PUT /api/admin/statements/{id}/sign-off` for the operator signature and for
 * an admin recording an owner's signature taken offline (the cash-first, RU
 * clientele of CLAUDE.md still signs paper). Both doors write through the
 * functions below, so the state machine exists once (Q33).
 */

export type StatementSignOffActor = 'owner' | 'operator';

/**
 * The statuses an owner may **open and read**. A `draft` statement has not
 * passed the admin sign-off gate (doc 10 money rules — "statements gate on admin
 * sign-off"), so it is not the owner's to read; everything past that point is.
 *
 * This is a visibility decision only. It must never gate a write — see
 * `SIGNABLE_STATEMENT_STATUSES`.
 */
export const OWNER_VISIBLE_STATEMENT_STATUSES: OwnerStatementStatus[] = [
  'published',
  'pending_owner_review',
  'signed_off',
  'distributed',
  'superseded',
];

export function isOwnerVisibleStatementStatus(
  status: OwnerStatementStatus
): boolean {
  return OWNER_VISIBLE_STATEMENT_STATUSES.includes(status);
}

/**
 * The statuses a signature may still be **written onto** — a strict subset of
 * the visible set.
 *
 * Reading and signing are two different decisions and need two different lists.
 * A closed statement (`signed_off`, `distributed`, `superseded`) stays readable
 * for the owner's records, but it is finished: taking a fresh signature on it
 * would re-stamp `approvedAt` and, for a `distributed` or `superseded`
 * statement, rewrite its status back to `signed_off` — losing the fact that the
 * money already went out or that a corrected statement replaced this one. The
 * ledger is append-only (CLAUDE.md money rules) and a closed statement is too.
 */
export const SIGNABLE_STATEMENT_STATUSES: OwnerStatementStatus[] = [
  'published',
  'pending_owner_review',
];

export function isSignableStatementStatus(
  status: OwnerStatementStatus
): boolean {
  return SIGNABLE_STATEMENT_STATUSES.includes(status);
}

/** The minimum a caller needs to authorize and evaluate a sign-off. */
export interface StatementSignOffState {
  id: string;
  unitId: string;
  ownerIdentityId: string;
  status: OwnerStatementStatus;
  signedOffByOwnerAt: Date | null;
  signedOffByOperatorAt: Date | null;
}

/** The sign-off shape both routes return (dates serialized for the wire). */
export interface StatementSignOffView {
  id: string;
  unitId: string;
  status: OwnerStatementStatus;
  signedOffByOwnerAt: string | null;
  signedOffByOperatorAt: string | null;
  approvedAt: string | null;
}

/** Load only the fields the sign-off decision needs. `null` = no such statement. */
export async function getStatementSignOffState(
  db: PrismaClient,
  statementId: string
): Promise<StatementSignOffState | null> {
  return db.ownerStatement.findUnique({
    where: { id: statementId },
    select: {
      id: true,
      unitId: true,
      ownerIdentityId: true,
      status: true,
      signedOffByOwnerAt: true,
      signedOffByOperatorAt: true,
    },
  });
}

/** Has this side already signed? A signature is recorded once, never twice. */
export function hasSignedOff(
  state: Pick<
    StatementSignOffState,
    'signedOffByOwnerAt' | 'signedOffByOperatorAt'
  >,
  actor: StatementSignOffActor
): boolean {
  return Boolean(
    actor === 'owner' ? state.signedOffByOwnerAt : state.signedOffByOperatorAt
  );
}

/**
 * Record one signature and move the statement's status accordingly:
 * both signatures present → `signed_off` + `approvedAt`; the operator signing
 * first → `pending_owner_review` (the statement now waits on the owner); the
 * owner signing first leaves the status where it was.
 *
 * The caller authorizes first — this function assumes the actor is allowed and
 * that `hasSignedOff` was checked. Atomicity: uses updateMany with a guard
 * clause so concurrent requests detect collisions instead of overwriting.
 */
export async function recordStatementSignOff(
  db: PrismaClient,
  state: StatementSignOffState,
  actor: StatementSignOffActor,
  now: Date = new Date()
): Promise<StatementSignOffView> {
  const data: Prisma.OwnerStatementUpdateInput =
    actor === 'owner'
      ? { signedOffByOwnerAt: now }
      : { signedOffByOperatorAt: now };

  const otherSignature =
    actor === 'owner'
      ? state.signedOffByOperatorAt
      : state.signedOffByOwnerAt;

  if (otherSignature) {
    data.status = 'signed_off';
    data.approvedAt = now;
  } else if (actor === 'operator') {
    data.status = 'pending_owner_review';
  }

  // Guard clause: the signature field must still be null. If a concurrent
  // request already signed, updateMany returns zero rows and we detect it.
  const guardWhere: Prisma.OwnerStatementWhereInput =
    actor === 'owner'
      ? { id: state.id, signedOffByOwnerAt: null }
      : { id: state.id, signedOffByOperatorAt: null };

  const updated = await db.ownerStatement.updateMany({
    where: guardWhere,
    data,
  });

  if (updated.count === 0) {
    throw new Error('Conflict: statement already signed by this actor');
  }

  // Re-fetch to return the full updated state.
  const refreshed = await db.ownerStatement.findUniqueOrThrow({
    where: { id: state.id },
  });

  return {
    id: refreshed.id,
    unitId: refreshed.unitId,
    status: refreshed.status,
    signedOffByOwnerAt: refreshed.signedOffByOwnerAt?.toISOString() ?? null,
    signedOffByOperatorAt: refreshed.signedOffByOperatorAt?.toISOString() ?? null,
    approvedAt: refreshed.approvedAt?.toISOString() ?? null,
  };
}
