import { PrismaClient, DepositClaim, DepositPreauth } from '@prisma/client';

export interface DepositClaimInput {
  bookingId: string;
  claimantIdentityId: string;
  description: string;
  claimedAmountThb: number;
  evidenceMediaIds?: string[];
}

export interface DepositClaimDetails extends DepositClaim {
  booking: { id: string; totalThb: number };
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
 * Void deposit pre-auth on clean checkout.
 * Called when condition report shows no damage; releases the hold.
 */
export async function voidDepositPreauthIfClean(
  db: PrismaClient,
  bookingId: string
): Promise<DepositPreauth> {
  const preauth = await db.depositPreauth.findUnique({
    where: { bookingId },
  });

  if (!preauth) {
    // No preauth for this booking (mode is 'off')
    throw new Error(`No deposit preauth found for booking ${bookingId}`);
  }

  if (preauth.status === 'voided' || preauth.status === 'captured') {
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
 * Capture deposit pre-auth when damage claim is approved.
 * Called within 48h window of claim filing.
 */
export async function captureDepositPreauthOnClaim(
  db: PrismaClient,
  bookingId: string,
  claimId: string
): Promise<DepositPreauth> {
  const preauth = await db.depositPreauth.findUnique({
    where: { bookingId },
  });

  if (!preauth) {
    throw new Error(`No deposit preauth found for booking ${bookingId}`);
  }

  if (preauth.status !== 'authorized') {
    throw new Error(`Cannot capture preauth with status ${preauth.status}`);
  }

  // Re-assert the status in the WHERE rather than trusting the read above.
  // The check and the write are two statements, so two concurrent claim
  // approvals for the same booking both observed `authorized` and both
  // captured — charging the guest twice, with the second write silently
  // replacing `captureViaClaimId`. The unique constraint on that column only
  // catches a repeat of the *same* claim, not two different ones. With the
  // predicate here exactly one update matches and the loser gets zero rows.
  const claimed = await db.depositPreauth.updateMany({
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

  return db.depositPreauth.findUniqueOrThrow({ where: { id: preauth.id } });
}

/**
 * Release deposit on dispute resolution (rejected claim or refund after approval).
 * Voids the preauth, returning funds to guest.
 */
export async function releaseDepositPreauthOnDispute(
  db: PrismaClient,
  bookingId: string
): Promise<DepositPreauth> {
  const preauth = await db.depositPreauth.findUnique({
    where: { bookingId },
  });

  if (!preauth) {
    throw new Error(`No deposit preauth found for booking ${bookingId}`);
  }

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

  // Verify claim filed within 48h of checkout
  const hoursSinceCheckout = (Date.now() - booking.checkedOutAt!.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCheckout > 48) {
    throw new Error(`Claim must be filed within 48 hours of checkout`);
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
    orderBy: {
      filedAt: 'asc',
    },
  }) as Promise<DepositClaimDetails[]>;
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
  });

  if (!claim) {
    throw new Error(`Claim ${claimId} not found`);
  }

  // Verify within 48h window
  const hoursSinceFiled = (Date.now() - claim.filedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceFiled > 48) {
    throw new Error(`Claim approval window (48h) has expired`);
  }

  // Capture the pre-auth deposit
  await captureDepositPreauthOnClaim(db, claim.bookingId, claimId);

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
 * Reject a damage claim: release the pre-auth deposit and mark claim rejected.
 * Called by admin; voids the preauth, returning funds to guest.
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
