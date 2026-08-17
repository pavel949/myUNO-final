import prismadb from './prismadb'
import { getConfig } from '@/modules/config/config.service'

/**
 * Schedule deposit pre-auth for a booking.
 * Called before check-in if mode=preauth and amount > 0.
 */
export async function scheduleDepositPreAuth(
  bookingId: string,
  unitId: string
): Promise<string | null> {
  // Get config for this unit
  const depositMode = await getConfig(prismadb, 'booking.deposit.mode', { unitId })
  const depositAmount = await getConfig(prismadb, 'booking.deposit.amount_thb', { unitId })

  if (depositMode !== 'preauth' || !depositAmount || depositAmount <= 0) {
    return null
  }

  // Create DepositPreauth record (via provider seam in production)
  const preauth = await prismadb.depositPreauth.create({
    data: {
      bookingId,
      amountThb: depositAmount as number,
      authorizedAt: new Date(),
      status: 'authorized',
      // In production, this is the provider's session ID from the preauth call
      providerSessionId: `mock-preauth-${bookingId}`,
    },
  })

  return preauth.id
}

/**
 * Void deposit preauth on clean checkout.
 * Called after check-out inspection confirms no damage.
 */
export async function voidDepositPreAuth(bookingId: string): Promise<void> {
  const preauth = await prismadb.depositPreauth.findUnique({
    where: { bookingId },
  })

  if (!preauth) {
    // No preauth for this booking (mode is 'off')
    return
  }

  if (preauth.status === 'voided') {
    return
  }

  // Void via provider seam (in production, calls provider's void API)
  console.log(`[DEPOSIT] Voiding preauth ${preauth.id} - clean checkout`)

  // Mark as voided
  await prismadb.depositPreauth.update({
    where: { id: preauth.id },
    data: {
      status: 'voided',
      voidedAt: new Date(),
    },
  })
}

/**
 * Capture deposit preauth on damage claim approval.
 * Called within 48h window; amount capped at preauth amount and claim amount.
 */
export async function captureDepositPreAuth(
  bookingId: string,
  claimId: string,
  captureAmount: number
): Promise<void> {
  const preauth = await prismadb.depositPreauth.findUnique({
    where: { bookingId },
  })

  if (!preauth) {
    throw new Error('No deposit preauth found for this booking')
  }

  if (preauth.status === 'voided') {
    throw new Error('Deposit preauth was already voided')
  }

  if (preauth.status === 'captured') {
    throw new Error('Deposit preauth was already captured')
  }

  // Cap capture at preauth amount
  const actualCapture = Math.min(captureAmount, preauth.amountThb)

  // Resolve the booking before any write. The ledger entry needs its unit, and
  // capturing a guest's money while silently skipping the ledger row — the old
  // `if (booking)` — leaves money moved with no record of it in an append-only
  // ledger (CLAUDE.md money rules). Missing booking is a failure, not a skip.
  const booking = await prismadb.booking.findUnique({
    where: { id: bookingId },
    include: { unit: true },
  })

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found — refusing to capture without a ledger entry`)
  }

  // Capture via provider seam (in production, calls provider's capture API)
  console.log(`[DEPOSIT] Capturing ${actualCapture} THB from preauth ${preauth.id} for claim ${claimId}`)

  // One transaction, and the status predicate makes the transition atomic.
  // The checks above read the preauth in a separate statement, so two
  // concurrent approvals both saw `authorized` and both captured the guest's
  // hold. Re-asserting `status: 'authorized'` in the WHERE means exactly one
  // update matches; the loser sees zero rows and throws instead of double
  // charging. Pairing it with the ledger insert keeps the two in step — a
  // failed insert now rolls the capture back rather than stranding it.
  await prismadb.$transaction(async (tx) => {
    const claimed = await tx.depositPreauth.updateMany({
      where: { id: preauth.id, status: 'authorized' },
      data: {
        status: 'captured',
        capturedAt: new Date(),
        captureViaClaimId: claimId,
      },
    })

    if (claimed.count === 0) {
      throw new Error('Deposit preauth is no longer capturable')
    }

    await tx.ledgerEntry.create({
      data: {
        entryType: 'adjustment',
        amountThb: actualCapture,
        unitId: booking.unit.id,
        bookingId: booking.id,
        description: `Damage claim capture: ฿${actualCapture} from deposit preauth (claim: ${claimId})`,
        occurredOn: new Date(),
      },
    })
  })
}
