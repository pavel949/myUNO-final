import { OwnerStatementStatus, Prisma, PrismaClient } from '@prisma/client';

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
 * The statuses an owner may open and sign. A `draft` statement has not passed
 * the admin sign-off gate (doc 10 money rules — "statements gate on admin
 * sign-off"), so it is not the owner's to read; everything past that point is.
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
 * that `hasSignedOff` was checked.
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

  const updated = await db.ownerStatement.update({
    where: { id: state.id },
    data,
  });

  return {
    id: updated.id,
    unitId: updated.unitId,
    status: updated.status,
    signedOffByOwnerAt: updated.signedOffByOwnerAt?.toISOString() ?? null,
    signedOffByOperatorAt: updated.signedOffByOperatorAt?.toISOString() ?? null,
    approvedAt: updated.approvedAt?.toISOString() ?? null,
  };
}
