import prismadb from './prismadb'
import { getConfig } from '@/modules/config/config.service'

/**
 * Initiate deposit pre-auth for a booking at check-in minus N days.
 * Only if mode=preauth and amount > 0.
 */
export async function initiateDepositPreAuth(
  bookingId: string,
  unitId: string,
  guestIdentityId: string
): Promise<string | null> {
  // Get config for this unit
  const depositMode = await getConfig(prismadb, 'booking.deposit.mode', { unitId })
  const depositAmount = await getConfig(prismadb, 'booking.deposit.amount_thb', { unitId })

  if (depositMode !== 'preauth' || !depositAmount || depositAmount <= 0) {
    return null
  }

  // Create payment for preauth (via provider seam in production)
  const payment = await prismadb.payment.create({
    data: {
      purpose: 'deposit_preauth',
      bookingId,
      payerIdentityId: guestIdentityId,
      method: 'card_provider',
      provider: 'mock',
      amountThb: depositAmount as number,
      status: 'pending',
    },
  })

  return payment.id
}

/**
 * Void deposit preauth on clean checkout.
 * Called after check-out inspection confirms no damage.
 */
export async function voidDepositPreAuth(paymentId: string): Promise<void> {
  const payment = await prismadb.payment.findUnique({
    where: { id: paymentId },
  })

  if (!payment) {
    throw new Error('Payment not found')
  }

  if (payment.purpose !== 'deposit_preauth') {
    throw new Error('Payment is not a deposit preauth')
  }

  if (payment.status === 'voided') {
    return
  }

  // Void via provider seam (in production, calls provider's void API)
  // For now, mock void
  console.log(`[DEPOSIT] Voiding preauth ${paymentId} - clean checkout`)

  // Mark as voided
  await prismadb.payment.update({
    where: { id: paymentId },
    data: { status: 'voided' },
  })
}

/**
 * Capture deposit preauth on damage claim approval.
 * Amount is capped at the preauth amount and claim amount.
 */
export async function captureDepositPreAuth(
  paymentId: string,
  claimId: string,
  captureAmount: number
): Promise<void> {
  const payment = await prismadb.payment.findUnique({
    where: { id: paymentId },
  })

  if (!payment) {
    throw new Error('Payment not found')
  }

  if (payment.purpose !== 'deposit_preauth') {
    throw new Error('Payment is not a deposit preauth')
  }

  if (payment.status === 'voided') {
    throw new Error('Deposit preauth was already voided')
  }

  // Cap capture at preauth amount
  const actualCapture = Math.min(captureAmount, payment.amountThb)

  // Capture via provider seam (in production, calls provider's capture API)
  console.log(`[DEPOSIT] Capturing ${actualCapture} THB from preauth ${paymentId} for claim ${claimId}`)

  // Update payment status to succeeded
  await prismadb.payment.update({
    where: { id: paymentId },
    data: {
      status: 'succeeded',
      succeededAt: new Date(),
    },
  })

  // Create ledger entry for captured amount
  if (payment.bookingId) {
    const booking = await prismadb.booking.findUnique({
      where: { id: payment.bookingId },
      include: { unit: true },
    })

    if (booking) {
      await prismadb.ledgerEntry.create({
        data: {
          entryType: 'adjustment',
          amountThb: actualCapture,
          unitId: booking.unit.id,
          bookingId: booking.id,
          paymentId: payment.id,
          description: `Damage claim capture: ${actualCapture} THB (claim: ${claimId})`,
          occurredOn: new Date(),
        },
      })
    }
  }
}
