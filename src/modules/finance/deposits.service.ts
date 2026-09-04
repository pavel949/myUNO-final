import { PrismaClient, DepositClaim, DepositPreauth, RoleType } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification, raiseDispute } from '@/modules/comms';

const HOUR_MS = 60 * 60 * 1000;

/**
 * How long a window lasts, from configuration rather than from a number in the
 * code (doc 04). These are SLAs, and CLAUDE.md admits no hardcoded ones — a
 * project that wants a 24-hour claim window must be able to have it without a
 * deployment.
 */
async function windowHours(
  db: PrismaClient,
  key: 'booking.deposit.claim_window_hours' | 'booking.deposit.approval_window_hours',
  projectId?: string,
  fallback = 48
): Promise<number> {
  const value = await getConfig(db, key, projectId ? { projectId } : undefined).catch(() => undefined);
  return typeof value === 'number' && value > 0 ? value : fallback;
}

export interface DepositClaimGuestView {
  id: string;
  description: string;
  claimedAmountThb: number;
  status: string;
  filedAt: Date;
  /** ISO deadline by which the guest may dispute before capture may proceed. */
  responseDeadlineAt: Date;
  canDispute: boolean;
}

/**
 * The active damage claim on a booking, for the guest-facing trip detail page.
 * Returns null when there is no claim or the guest should not see it.
 */
export async function getActiveDepositClaimForGuest(
  db: PrismaClient,
  bookingId: string
): Promise<DepositClaimGuestView | null> {
  const claim = await db.depositClaim.findFirst({
    where: {
      bookingId,
      status: { in: ['filed', 'disputed', 'approved', 'rejected'] },
    },
    orderBy: { filedAt: 'desc' },
    include: { booking: { select: { projectId: true } } },
  });
  if (!claim) return null;

  const hours = await windowHours(
    db,
    'booking.deposit.approval_window_hours',
    claim.booking.projectId
  );
  const responseDeadlineAt = new Date(claim.filedAt.getTime() + hours * HOUR_MS);

  return {
    id: claim.id,
    description: claim.description,
    claimedAmountThb: claim.claimedAmountThb,
    status: claim.status,
    filedAt: claim.filedAt,
    responseDeadlineAt,
    canDispute: claim.status === 'filed',
  };
}

/**
 * Guest disputes a filed damage claim (doc 07 F-DIS-1 → F-DIS-2).
 * Marks the claim disputed and opens the neutral-arbiter dispute ticket.
 */
export async function disputeDepositClaim(
  db: PrismaClient,
  input: {
    claimId: string;
    guestIdentityId: string;
    raisedByRole: RoleType;
    title: string;
    description: string;
  }
): Promise<DepositClaim> {
  const claim = await db.depositClaim.findUnique({
    where: { id: input.claimId },
    include: {
      booking: {
        select: { id: true, guestIdentityId: true, projectId: true },
      },
    },
  });

  if (!claim) {
    throw new Error('Claim not found');
  }
  if (claim.booking.guestIdentityId !== input.guestIdentityId) {
    throw new Error('You can only dispute a claim on your own stay');
  }
  if (claim.status !== 'filed') {
    const error = new Error('This claim can no longer be disputed');
    (error as { code?: string }).code = 'NOT_DISPUTABLE';
    throw error;
  }

  const existingDispute = await db.dispute.findFirst({
    where: { subjectType: 'booking', subjectId: claim.bookingId },
  });
  if (!existingDispute) {
    await raiseDispute(db, {
      subjectType: 'booking',
      subjectId: claim.bookingId,
      raisedByIdentityId: input.guestIdentityId,
      raisedByRole: input.raisedByRole,
      title: input.title,
      description: input.description,
    });
  }

  return db.depositClaim.update({
    where: { id: input.claimId },
    data: { status: 'disputed' },
  });
}

export interface DepositClaimInput {
  bookingId: string;
  claimantIdentityId: string;
  description: string;
  claimedAmountThb: number;
  evidenceMediaIds?: string[];
}

export interface DepositClaimDetails extends DepositClaim {
  booking: {
    id: string;
    totalThb: number;
    checkedOutAt: Date | null;
    unit: { id: string; name: string } | null;
    guestIdentity: { id: string; firstName: string; lastName: string } | null;
    depositPreauth: { amountThb: number; status: string } | null;
  };
  claimant: { id: string; firstName: string; lastName: string };
}

/**
 * Create a pre-authorization deposit hold via the provider.
 * Returns DepositPreauth with status 'authorized'.
 * Config determines the amount and timing (pre-check-in scheduling).
 */
export async function scheduleDepositPreauth(
  db: PrismaClient,
  bookingId: string,
  amountThb: number
): Promise<DepositPreauth> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  // Create pre-auth via the seam (in loop one, this calls the provider directly)
  const preauth = await db.depositPreauth.create({
    data: {
      bookingId,
      amountThb,
      authorizedAt: new Date(),
      status: 'authorized',
      // In production, providerSessionId is returned from the provider seam
      providerSessionId: `mock-preauth-${bookingId}`,
    },
  });

  return preauth;
}

/**
 * Take the pre-authorization a unit's configuration calls for, if it calls for
 * one at all.
 *
 * Config decides both whether there is a deposit and how much (doc 04). A unit
 * with `mode: off`, or an amount of zero, gets nothing — and that is a normal
 * outcome, not a failure, so it returns null rather than throwing.
 */
export async function scheduleDepositPreauthIfConfigured(
  db: PrismaClient,
  bookingId: string,
  unitId: string
): Promise<DepositPreauth | null> {
  const mode = await getConfig(db, 'booking.deposit.mode', { unitId });
  const amountThb = await getConfig(db, 'booking.deposit.amount_thb', { unitId });

  if (mode !== 'preauth' || !amountThb || amountThb <= 0) return null;

  const existing = await db.depositPreauth.findUnique({ where: { bookingId } });
  if (existing) return existing;

  return scheduleDepositPreauth(db, bookingId, amountThb as number);
}

/**
 * Place a deposit pre-authorization when a stay becomes confirmed (Q46 / doc 04).
 * Idempotent — safe to call from every confirmation path.
 */
export async function ensureDepositPreauthOnStayConfirmed(
  db: PrismaClient,
  bookingId: string,
  unitId: string
): Promise<DepositPreauth | null> {
  return scheduleDepositPreauthIfConfigured(db, bookingId, unitId);
}

/**
 * Void deposit pre-auth on clean checkout.
 * Called when condition report shows no damage; releases the hold.
 */
export async function voidDepositPreauthIfClean(
  db: PrismaClient,
  bookingId: string
): Promise<DepositPreauth | null> {
  const preauth = await db.depositPreauth.findUnique({
    where: { bookingId },
  });

  // Nothing was held, so there is nothing to release. A stay on a unit with
  // deposits switched off reaches here on every clean check-out, and treating
  // that as an error would make the ordinary case throw.
  if (!preauth) return null;

  // Already released: voiding twice is the same outcome, and a retried
  // check-out should not fail.
  if (preauth.status === 'voided') return preauth;

  if (preauth.status === 'captured') {
    throw new Error(`Cannot void preauth with status ${preauth.status}`);
  }

  // Void the pre-auth
  const voided = await db.depositPreauth.update({
    where: { id: preauth.id },
    data: {
      status: 'voided',
      voidedAt: new Date(),
    },
  });

  return voided;
}

/**
 * Capture a pre-authorization because a damage claim was approved.
 *
 * Two things here are not optional, and this function used to do neither:
 *
 * 1. **It captures the claimed amount, capped at what was held** — not the
 *    whole hold. A ฿1,200 broken lamp against a ฿5,000 deposit takes ฿1,200.
 *    Taking the full hold for any approved claim is simply overcharging.
 * 2. **It writes the ledger entry in the same transaction.** The ledger is
 *    append-only and every movement of money belongs in it (CLAUDE.md money
 *    rules). Capturing without a ledger row moves a guest's money with no
 *    record, and an owner statement built afterwards is wrong by exactly that
 *    amount. Pairing the two means a failed insert rolls the capture back
 *    rather than stranding it.
 */
export async function captureDepositPreauthOnClaim(
  db: PrismaClient,
  bookingId: string,
  claimId: string,
  captureAmountThb: number
): Promise<DepositPreauth> {
  const preauth = await db.depositPreauth.findUnique({
    where: { bookingId },
  });

  if (!preauth) {
    const error = new Error(`No deposit pre-authorization found for booking ${bookingId}`);
    (error as { code?: string }).code = 'NO_PREAUTH';
    throw error;
  }

  if (preauth.status !== 'authorized') {
    // Codes rather than message text: callers and tests should not depend on
    // wording, and "already voided" and "already captured" mean different
    // things to whoever is reading the failure.
    const error = new Error(
      `This deposit pre-authorization was already ${preauth.status}`
    );
    (error as { code?: string }).code =
      preauth.status === 'captured' ? 'ALREADY_CAPTURED' : 'ALREADY_VOIDED';
    throw error;
  }

  const actualCapture = Math.min(captureAmountThb, preauth.amountThb);
  if (!Number.isInteger(actualCapture) || actualCapture <= 0) {
    throw new Error('A capture must be a positive amount in satang');
  }

  // Resolve the booking before any write: the ledger entry needs its unit, and
  // a missing booking is a reason to refuse the capture, not to skip the record.
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, unitId: true },
  });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found — refusing to capture without a ledger entry`);
  }

  // Re-assert the status in the WHERE rather than trusting the read above.
  // The check and the write are two statements, so two concurrent claim
  // approvals for the same booking both observed `authorized` and both
  // captured — charging the guest twice, with the second write silently
  // replacing `captureViaClaimId`. The unique constraint on that column only
  // catches a repeat of the *same* claim, not two different ones. With the
  // predicate here exactly one update matches and the loser gets zero rows.
  await db.$transaction(async (tx) => {
    const claimed = await tx.depositPreauth.updateMany({
      where: { id: preauth.id, status: 'authorized' },
      data: {
        status: 'captured',
        capturedAt: new Date(),
        captureViaClaimId: claimId,
      },
    });

    if (claimed.count === 0) {
      throw new Error(
        `Preauth for booking ${bookingId} is no longer capturable — a concurrent claim resolved it first`
      );
    }

    await tx.ledgerEntry.create({
      data: {
        entryType: 'adjustment',
        amountThb: actualCapture,
        unitId: booking.unitId,
        bookingId: booking.id,
        description: `Damage claim capture from deposit pre-authorization (claim ${claimId})`,
        occurredOn: new Date(),
      },
    });
  });

  return db.depositPreauth.findUniqueOrThrow({ where: { id: preauth.id } });
}

/**
 * Release deposit on dispute resolution (rejected claim or refund after approval).
 * Voids the preauth, returning funds to guest.
 */
export async function releaseDepositPreauthOnDispute(
  db: PrismaClient,
  bookingId: string
): Promise<DepositPreauth | null> {
  const preauth = await db.depositPreauth.findUnique({
    where: { bookingId },
  });

  // Nothing held means nothing to release, and that must not stop a claim being
  // rejected: a claim that cannot be closed is a claim that stays open forever.
  if (!preauth) return null;

  if (preauth.status === 'voided') {
    // Already voided, return it
    return preauth;
  }

  // Release (void) the pre-auth
  const released = await db.depositPreauth.update({
    where: { id: preauth.id },
    data: {
      status: 'voided',
      voidedAt: new Date(),
    },
  });

  return released;
}

/**
 * File a damage claim within 48h of checkout.
 * Staff attach photos to check-out ConditionReport + estimated cost.
 * Claim enters 'filed' status; awaits admin review within 48h window.
 */
export async function fileDepositClaim(db: PrismaClient, input: DepositClaimInput): Promise<DepositClaim> {
  const { bookingId, claimantIdentityId, description, claimedAmountThb, evidenceMediaIds } = input;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  // Verify checkout happened
  if (booking.checkedOutAt === null) {
    throw new Error(`Booking has not checked out yet`);
  }

  if (!Number.isInteger(claimedAmountThb) || claimedAmountThb <= 0) {
    throw new Error('A claim must be for a positive amount in satang');
  }

  // The window is configuration, not a constant (doc 04).
  const hours = await windowHours(db, 'booking.deposit.claim_window_hours', booking.projectId);
  const hoursSinceCheckout = (Date.now() - booking.checkedOutAt!.getTime()) / HOUR_MS;
  if (hoursSinceCheckout > hours) {
    const error = new Error(`A claim must be filed within ${hours} hours of check-out`);
    (error as { code?: string }).code = 'WINDOW_CLOSED';
    throw error;
  }

  // Create the claim
  const claim = await db.depositClaim.create({
    data: {
      bookingId,
      claimantIdentityId,
      description,
      claimedAmountThb,
      evidenceMediaIds: evidenceMediaIds || [],
      filedAt: new Date(),
      status: 'filed',
    },
  });

  // N-28: guest must see the claim and has a response window before capture.
  const bookingWithGuest = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      guestIdentityId: true,
      projectId: true,
      unit: { select: { name: true } },
    },
  });
  if (bookingWithGuest) {
    const responseHours = await windowHours(
      db,
      'booking.deposit.approval_window_hours',
      bookingWithGuest.projectId
    );
    await createNotification(db, {
      identityId: bookingWithGuest.guestIdentityId,
      type: 'stay_damage_claim',
      titleKey: 'notify.stay.damage_claim.title',
      bodyKey: 'notify.stay.damage_claim.body',
      params: {
        unit_name: bookingWithGuest.unit?.name ?? 'your stay',
        amount_thb: Math.round(claimedAmountThb / 100),
        description,
        hours: responseHours,
      },
    }).catch(() => null);
  }

  return claim;
}

/**
 * List deposit claims awaiting resolution (filed or disputed).
 * Used by admin board F-DIS-1 to adjudicate and approve/reject.
 */
export async function getClaimsAwaitingResolution(db: PrismaClient): Promise<DepositClaimDetails[]> {
  return db.depositClaim.findMany({
    where: {
      status: {
        in: ['filed', 'disputed'],
      },
    },
    include: {
      booking: {
        select: {
          id: true,
          totalThb: true,
          checkedOutAt: true,
          unit: { select: { id: true, name: true } },
          guestIdentity: { select: { id: true, firstName: true, lastName: true } },
          // Whoever adjudicates needs to see what is actually being held before
          // deciding how much of it to take.
          depositPreauth: { select: { amountThb: true, status: true } },
        },
      },
      claimant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    // Oldest first: the one closest to its window closing is the one that needs
    // a decision today.
    orderBy: {
      filedAt: 'asc',
    },
  }) as Promise<DepositClaimDetails[]>;
}

export interface ClaimableStay {
  bookingId: string;
  unitName: string;
  guestName: string;
  checkedOutAt: Date;
  /** Whole hours remaining in which a claim may still be filed. */
  hoursLeft: number;
  preauthAmountThb: number | null;
  existingClaims: number;
}

/**
 * Stays that have just checked out and can still be claimed against.
 *
 * The window is short by design (doc 04), so the useful question for a staff
 * member is not "which bookings exist" but "which ones can I still act on, and
 * for how long". Anything past the window is left out rather than shown as a
 * dead row.
 */
export async function getStaysOpenToClaim(
  db: PrismaClient,
  projectId?: string,
  now: Date = new Date()
): Promise<ClaimableStay[]> {
  const hours = await windowHours(db, 'booking.deposit.claim_window_hours', projectId);
  const since = new Date(now.getTime() - hours * HOUR_MS);

  const bookings = await db.booking.findMany({
    where: {
      checkedOutAt: { gte: since, not: null },
      ...(projectId ? { projectId } : {}),
    },
    select: {
      id: true,
      checkedOutAt: true,
      unit: { select: { name: true } },
      guestIdentity: { select: { firstName: true, lastName: true } },
      depositPreauth: { select: { amountThb: true } },
      _count: { select: { depositClaims: true } },
    },
    orderBy: { checkedOutAt: 'asc' },
  });

  return bookings.map((b) => ({
    bookingId: b.id,
    unitName: b.unit?.name ?? '—',
    guestName: b.guestIdentity
      ? `${b.guestIdentity.firstName} ${b.guestIdentity.lastName}`.trim()
      : '—',
    checkedOutAt: b.checkedOutAt!,
    hoursLeft: Math.max(
      0,
      Math.floor(hours - (now.getTime() - b.checkedOutAt!.getTime()) / HOUR_MS)
    ),
    preauthAmountThb: b.depositPreauth?.amountThb ?? null,
    existingClaims: b._count.depositClaims,
  }));
}

/**
 * Approve a damage claim: capture the pre-auth deposit and mark claim approved.
 * Called by admin within 48h window; captures the preauth up to claimed amount.
 */
export async function approveClaim(
  db: PrismaClient,
  claimId: string,
  resolutionNote?: string
): Promise<DepositClaim> {
  const claim = await db.depositClaim.findUnique({
    where: { id: claimId },
    include: { booking: { select: { projectId: true } } },
  });

  if (!claim) {
    throw new Error(`Claim ${claimId} not found`);
  }

  if (claim.status !== 'filed' && claim.status !== 'disputed') {
    const error = new Error('This claim has already been resolved');
    (error as { code?: string }).code = 'ALREADY_RESOLVED';
    throw error;
  }

  // Capturing money from a guest is the part that expires. See rejectClaim for
  // why releasing it does not.
  const hours = await windowHours(
    db,
    'booking.deposit.approval_window_hours',
    claim.booking.projectId
  );
  const hoursSinceFiled = (Date.now() - claim.filedAt.getTime()) / HOUR_MS;
  if (hoursSinceFiled > hours) {
    const error = new Error(`The window to approve this claim (${hours} hours) has passed`);
    (error as { code?: string }).code = 'WINDOW_CLOSED';
    throw error;
  }

  // Capture the pre-auth deposit
  // The claim's own amount, capped inside at what was actually held.
  await captureDepositPreauthOnClaim(db, claim.bookingId, claimId, claim.claimedAmountThb);

  // Approve the claim
  const approved = await db.depositClaim.update({
    where: { id: claimId },
    data: {
      status: 'approved',
      resolutionAt: new Date(),
      resolutionNote,
    },
  });

  return approved;
}

/**
 * Reject a damage claim: release the pre-authorization and mark it rejected.
 *
 * Deliberately **not** time-barred, unlike approval. If rejection expired too,
 * a claim nobody got to in time would leave the guest's pre-authorization
 * stranded — neither captured nor released — and holding a guest's money
 * because an admin was on holiday is fund-holding by neglect (Q6, Bank of
 * Thailand). Releasing money back to a guest must always be possible.
 */
export async function rejectClaim(
  db: PrismaClient,
  claimId: string,
  resolutionNote?: string
): Promise<DepositClaim> {
  const claim = await db.depositClaim.findUnique({
    where: { id: claimId },
  });

  if (!claim) {
    throw new Error(`Claim ${claimId} not found`);
  }

  if (claim.status !== 'filed' && claim.status !== 'disputed') {
    const error = new Error('This claim has already been resolved');
    (error as { code?: string }).code = 'ALREADY_RESOLVED';
    throw error;
  }

  // Release the pre-auth deposit
  await releaseDepositPreauthOnDispute(db, claim.bookingId);

  // Reject the claim
  const rejected = await db.depositClaim.update({
    where: { id: claimId },
    data: {
      status: 'rejected',
      resolutionAt: new Date(),
      resolutionNote,
    },
  });

  return rejected;
}
