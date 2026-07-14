import { PrismaClient, DepositClaim, Payment } from '@prisma/client';

export interface DepositClaimInput {
  reservationId: string;
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
 * Create a pre-authorization deposit hold (via payment seam).
 * Deposit is held as a provider pre-auth; amount configurable per project.
 * Returns Payment with status 'created' or 'pending' depending on provider.
 */
export async function createPreAuthDeposit(
  db: PrismaClient,
  bookingId: string,
  amountThb: number
): Promise<Payment> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  // Create pre-auth payment via the seam
  const payment = await db.payment.create({
    data: {
      purpose: 'deposit_preauth',
      bookingId,
      payerIdentityId: booking.guestIdentityId,
      method: 'card_provider',
      provider: 'mock', // In production, this comes from config
      amountThb,
      status: 'created',
    },
  });

  return payment;
}

/**
 * Void deposit pre-auth on clean checkout.
 * Called when condition report shows no damage; releases the hold.
 * Transitions payment.status to 'voided'.
 */
export async function voidDepositOnCleanCheckout(
  db: PrismaClient,
  paymentId: string
): Promise<Payment> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  if (payment.purpose !== 'deposit_preauth') {
    throw new Error(`Payment is not a deposit pre-auth`);
  }

  // Void the pre-auth
  const voided = await db.payment.update({
    where: { id: paymentId },
    data: {
      status: 'voided',
    },
  });

  return voided;
}

/**
 * Capture deposit pre-auth when damage claim is filed.
 * Transitions payment.status to 'succeeded' (captured from guest card).
 * Damage claim is recorded separately with evidence.
 */
export async function captureDepositOnClaim(
  db: PrismaClient,
  claimId: string
): Promise<Payment> {
  const claim = await db.depositClaim.findUnique({
    where: { id: claimId },
    include: { booking: { include: { payments: { where: { purpose: 'deposit_preauth' } } } } },
  });

  if (!claim) {
    throw new Error(`Claim ${claimId} not found`);
  }

  // Find the pre-auth payment for this booking
  const preAuth = claim.booking.payments[0];
  if (!preAuth) {
    throw new Error(`No pre-auth deposit found for booking ${claim.bookingId}`);
  }

  // Capture the pre-auth
  const captured = await db.payment.update({
    where: { id: preAuth.id },
    data: {
      status: 'succeeded',
      receivedAt: new Date(),
    },
  });

  return captured;
}

/**
 * Release deposit on dispute resolution (rejected claim or refund after approval).
 * Transitions payment.status back to 'voided' (funds returned to guest).
 */
export async function releaseDepositOnDisputeResolution(
  db: PrismaClient,
  claimId: string
): Promise<Payment> {
  const claim = await db.depositClaim.findUnique({
    where: { id: claimId },
    include: { booking: { include: { payments: { where: { purpose: 'deposit_preauth' } } } } },
  });

  if (!claim) {
    throw new Error(`Claim ${claimId} not found`);
  }

  const preAuth = claim.booking.payments[0];
  if (!preAuth) {
    throw new Error(`No pre-auth deposit found for booking ${claim.bookingId}`);
  }

  // Release (void) the pre-auth
  const released = await db.payment.update({
    where: { id: preAuth.id },
    data: {
      status: 'voided',
    },
  });

  return released;
}

/**
 * File a damage claim within 48h of checkout.
 * Guest provides description and attaches evidence (photos/documents).
 * Claim enters 'filed' status; awaits admin review.
 */
export async function fileDepositClaim(db: PrismaClient, input: DepositClaimInput): Promise<DepositClaim> {
  const { reservationId, claimantIdentityId, description, claimedAmountThb, evidenceMediaIds } = input;

  const booking = await db.booking.findUnique({
    where: { id: reservationId },
  });

  if (!booking) {
    throw new Error(`Booking ${reservationId} not found`);
  }

  // Verify checkout happened (status is checked_out or completed)
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
      bookingId: reservationId,
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
 * Transitions claim.status to 'approved' and captures pre-auth payment.
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

  // Capture the pre-auth payment
  await captureDepositOnClaim(db, claimId);

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
 * Transitions claim.status to 'rejected' and voids pre-auth payment.
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

  // Release the pre-auth payment
  await releaseDepositOnDisputeResolution(db, claimId);

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
