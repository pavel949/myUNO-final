import type { OwnerStatementStatus, Prisma, PrismaClient } from '@prisma/client';
import { lockUnitLedgerExclusive } from './ledger.service';
import { verifyStatementSnapshot } from './statement-snapshot';

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
 * The statuses a signature may still be **written onto** — every status that is
 * not yet closed.
 *
 * Reading and signing are two different decisions and need two different lists.
 * A closed statement (`signed_off`, `distributed`, `superseded`) stays readable
 * for the owner's records, but it is finished: taking a fresh signature on it
 * would re-stamp `approvedAt` and, for a `distributed` or `superseded`
 * statement, rewrite its status back to `signed_off` — losing the fact that the
 * money already went out or that a corrected statement replaced this one. The
 * ledger is append-only (CLAUDE.md money rules) and a closed statement is too.
 *
 * `draft` belongs here. A freshly generated statement is a draft, and signing it
 * **is** the admin sign-off gate that moves it forward (doc 10 money rules —
 * "statements gate on admin sign-off"). What a draft is not is the *owner's* to
 * sign: that is a visibility rule, so the owner route pairs this check with
 * `isOwnerVisibleStatementStatus` rather than this list carrying the exception.
 */
export const SIGNABLE_STATEMENT_STATUSES: OwnerStatementStatus[] = [
  'draft',
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

/** Why a sign-off was refused. Routes map these onto status codes. */
export type StatementSignOffFailure =
  | 'not_found'
  | 'not_signable'
  | 'already_signed'
  // The facts the statement was built from changed after it was generated
  // (a cost, a reversal, a receipt, the ownership chain). Regenerate it.
  | 'stale'
  // The issued figures/lines no longer match the snapshot taken at generation.
  | 'snapshot_mismatch';

/**
 * A refused sign-off. Carries the reason as data so each route can choose its
 * own answer: the owner route hides a non-signable statement behind a 404 (its
 * scope convention — a statement they may not write is not theirs to address),
 * while the admin route answers 409 and says which status blocked it.
 */
export class StatementSignOffError extends Error {
  readonly reason: StatementSignOffFailure;

  constructor(reason: StatementSignOffFailure, message: string) {
    super(message);
    this.name = 'StatementSignOffError';
    this.reason = reason;
  }
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
 * Takes the statement **id**, not a previously-read state, and re-reads under a
 * row lock — because every part of this decision is a race otherwise. Two
 * signatures arriving together each read "the other side hasn't signed", and
 * both write without the `signed_off` transition: the statement ends up with two
 * signatures, no `approvedAt`, and a status that says it is still waiting. A
 * signature landing beside a `distributed` transition would likewise rewrite a
 * closed statement back open. `SELECT … FOR UPDATE` serializes the pair, so the
 * second request decides against what the first actually wrote.
 *
 * The caller authorizes (whose statement this is); this function owns the state
 * machine and re-checks status and duplicate signature inside the lock, throwing
 * `StatementSignOffError` rather than trusting the caller's earlier read.
 *
 * Lock order is fixed across the module: the unit's ledger lock (exclusive —
 * no cost, reversal or receipt can commit while a statement is being frozen),
 * then the statement row. The snapshot is verified under both, so "fresh" means
 * fresh at the instant of signing.
 */
export async function recordStatementSignOff(
  db: PrismaClient,
  statementId: string,
  actor: StatementSignOffActor,
  now: Date = new Date(),
  actorIdentityId?: string
): Promise<StatementSignOffView> {
  return db.$transaction(async (tx) => {
    // The unit never changes for a statement, so reading it before the locks is
    // safe; it is what the lock order needs to start from.
    const head = await tx.ownerStatement.findUnique({
      where: { id: statementId },
      select: { unitId: true },
    });
    if (!head) {
      throw new StatementSignOffError(
        'not_found',
        `Statement ${statementId} not found`
      );
    }
    await lockUnitLedgerExclusive(tx, head.unitId);

    // Take the row lock next. A concurrent sign-off blocks here and, once the
    // first commits, reads the row it wrote — never the stale pre-write copy.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM owner_statement WHERE id = ${statementId} FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new StatementSignOffError(
        'not_found',
        `Statement ${statementId} not found`
      );
    }

    const fresh = await tx.ownerStatement.findUniqueOrThrow({
      where: { id: statementId },
    });

    // Duplicate before closed, because the two overlap: a signed_off statement
    // is closed *and* already carries this actor's signature. "You already
    // signed" is the more specific and more useful of the two answers.
    if (hasSignedOff(fresh, actor)) {
      throw new StatementSignOffError(
        'already_signed',
        `The ${actor} has already signed off this statement`
      );
    }

    // A closed statement is finished. Signing it would re-stamp `approvedAt`
    // and drag `distributed`/`superseded` back to `signed_off`, losing the fact
    // that the money went out or that a correction replaced this statement.
    if (!isSignableStatementStatus(fresh.status)) {
      throw new StatementSignOffError(
        'not_signable',
        `Statement ${statementId} is ${fresh.status} and can no longer be signed`
      );
    }

    const verdict = await verifyStatementSnapshot(tx, {
      ...fresh,
      engagementId: fresh.engagementId,
    });
    if (!verdict.ok) {
      throw new StatementSignOffError(
        verdict.reason,
        verdict.reason === 'stale'
          ? 'The statement is out of date: costs, receipts or ownership changed after it was prepared. Regenerate it before signing.'
          : 'The statement no longer matches the snapshot it was prepared with.'
      );
    }

    const data: Prisma.OwnerStatementUpdateInput =
      actor === 'owner'
        ? { signedOffByOwnerAt: now }
        : { signedOffByOperatorAt: now };

    const otherSignature =
      actor === 'owner'
        ? fresh.signedOffByOperatorAt
        : fresh.signedOffByOwnerAt;

    if (otherSignature) {
      data.status = 'signed_off';
      data.approvedAt = now;
    } else if (actor === 'operator') {
      data.status = 'pending_owner_review';
    }

    const updated = await tx.ownerStatement.update({
      where: { id: statementId },
      data,
    });

    await tx.auditLog.create({
      data: {
        action: 'statement_signed',
        entityType: 'owner_statement',
        entityId: statementId,
        actorIdentityId: actorIdentityId ?? null,
        data: {
          signer: actor,
          status: updated.status,
          snapshotHash: fresh.snapshotHash,
          verified: verdict.verified,
        },
      },
    });

    return {
      id: updated.id,
      unitId: updated.unitId,
      status: updated.status,
      signedOffByOwnerAt: updated.signedOffByOwnerAt?.toISOString() ?? null,
      signedOffByOperatorAt:
        updated.signedOffByOperatorAt?.toISOString() ?? null,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
    };
  });
}
