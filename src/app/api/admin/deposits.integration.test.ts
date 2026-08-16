import { describe, it, expect, beforeEach } from 'vitest'
import prismadb from '@/app/libs/prismadb'
import { resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util'
import {
  scheduleDepositPreAuth,
  voidDepositPreAuth,
  captureDepositPreAuth,
} from '@/app/libs/deposits'

// The deposit rail is keyed by booking, not by payment: doc 10 forbids holding
// guest funds, so a deposit is only ever a provider pre-authorization recorded
// on `deposit_preauth` — there is no Payment row to assert against.
async function setDepositConfig(unitId: string, mode: string, amountThb?: number) {
  await prismadb.configOverride.create({
    data: {
      parameterKey: 'booking.deposit.mode',
      scopeType: 'unit',
      scopeId: unitId,
      value: mode,
      updatedByIdentityId: 'test',
    },
  })

  if (amountThb !== undefined) {
    await prismadb.configOverride.create({
      data: {
        parameterKey: 'booking.deposit.amount_thb',
        scopeType: 'unit',
        scopeId: unitId,
        value: amountThb,
        updatedByIdentityId: 'test',
      },
    })
  }
}

async function bookingWithDeposit(mode: string, amountThb?: number) {
  const guest = await createIdentity()
  const admin = await createIdentity()
  const project = await createProject()
  const unit = await createUnit(project.id)

  await setDepositConfig(unit.id, mode, amountThb)

  const booking = await createBooking({
    unitId: unit.id,
    projectId: project.id,
    guestIdentityId: guest.id,
  })

  return { guest, admin, project, unit, booking }
}

describe('T-032: Deposits & Damage Claims', () => {
  beforeEach(async () => {
    await resetDb()
  })

  describe('Deposit Pre-Auth', () => {
    it('should schedule deposit preauth when mode=preauth and amount > 0', async () => {
      const { unit, booking } = await bookingWithDeposit('preauth', 10000)

      const preauthId = await scheduleDepositPreAuth(booking.id, unit.id)

      expect(preauthId).not.toBeNull()

      const preauth = await prismadb.depositPreauth.findUnique({
        where: { id: preauthId! },
      })

      expect(preauth?.bookingId).toBe(booking.id)
      expect(preauth?.amountThb).toBe(10000)
      expect(preauth?.status).toBe('authorized')
      expect(preauth?.authorizedAt).toBeInstanceOf(Date)
    })

    it('should not schedule preauth when mode=off', async () => {
      const { unit, booking } = await bookingWithDeposit('off')

      const preauthId = await scheduleDepositPreAuth(booking.id, unit.id)

      expect(preauthId).toBeNull()
      expect(
        await prismadb.depositPreauth.findUnique({ where: { bookingId: booking.id } })
      ).toBeNull()
    })

    it('should not schedule preauth when the configured amount is zero', async () => {
      const { unit, booking } = await bookingWithDeposit('preauth', 0)

      expect(await scheduleDepositPreAuth(booking.id, unit.id)).toBeNull()
    })
  })

  describe('Void on clean checkout', () => {
    it('should void deposit preauth on clean checkout', async () => {
      const { unit, booking } = await bookingWithDeposit('preauth', 5000)
      const preauthId = await scheduleDepositPreAuth(booking.id, unit.id)

      expect(preauthId).not.toBeNull()

      await voidDepositPreAuth(booking.id)

      const preauth = await prismadb.depositPreauth.findUnique({
        where: { id: preauthId! },
      })

      expect(preauth?.status).toBe('voided')
      expect(preauth?.voidedAt).toBeInstanceOf(Date)
    })

    it('should be a no-op on an already-voided preauth', async () => {
      const { unit, booking } = await bookingWithDeposit('preauth', 5000)
      const preauthId = await scheduleDepositPreAuth(booking.id, unit.id)

      await voidDepositPreAuth(booking.id)
      const firstVoidAt = (
        await prismadb.depositPreauth.findUnique({ where: { id: preauthId! } })
      )?.voidedAt

      await voidDepositPreAuth(booking.id) // must not throw, must not re-stamp

      const preauth = await prismadb.depositPreauth.findUnique({
        where: { id: preauthId! },
      })

      expect(preauth?.status).toBe('voided')
      expect(preauth?.voidedAt).toEqual(firstVoidAt)
    })

    it('should be a no-op when the booking never had a preauth', async () => {
      const { booking } = await bookingWithDeposit('off')

      await expect(voidDepositPreAuth(booking.id)).resolves.toBeUndefined()
    })
  })

  describe('Capture on damage claim', () => {
    it('should capture deposit preauth on damage claim approval', async () => {
      const { admin, unit, booking } = await bookingWithDeposit('preauth', 8000)
      const preauthId = await scheduleDepositPreAuth(booking.id, unit.id)

      expect(preauthId).not.toBeNull()

      const claim = await prismadb.depositClaim.create({
        data: {
          bookingId: booking.id,
          claimantIdentityId: admin.id,
          description: 'Guest damaged furniture',
          claimedAmountThb: 3000,
          status: 'filed',
          filedAt: new Date(),
        },
      })

      await captureDepositPreAuth(booking.id, claim.id, 3000)

      const preauth = await prismadb.depositPreauth.findUnique({
        where: { id: preauthId! },
      })

      expect(preauth?.status).toBe('captured')
      expect(preauth?.capturedAt).toBeInstanceOf(Date)
      expect(preauth?.captureViaClaimId).toBe(claim.id)

      // Every captured baht lands in the append-only ledger against the unit
      // and the booking it came from (doc 10).
      const ledgerEntry = await prismadb.ledgerEntry.findFirst({
        where: { bookingId: booking.id, entryType: 'adjustment' },
      })

      expect(ledgerEntry).not.toBeNull()
      expect(ledgerEntry?.unitId).toBe(unit.id)
      expect(ledgerEntry?.amountThb).toBe(3000)
      expect(ledgerEntry?.description).toContain(claim.id)
    })

    it('should cap capture amount at preauth amount', async () => {
      const { admin, unit, booking } = await bookingWithDeposit('preauth', 5000)
      await scheduleDepositPreAuth(booking.id, unit.id)

      const claim = await prismadb.depositClaim.create({
        data: {
          bookingId: booking.id,
          claimantIdentityId: admin.id,
          description: 'Damage exceeds deposit',
          claimedAmountThb: 10000,
          status: 'filed',
          filedAt: new Date(),
        },
      })

      // Claim is for 10000 but the hold is only 5000 — never capture more than
      // the guest actually pre-authorized.
      await captureDepositPreAuth(booking.id, claim.id, 10000)

      const ledgerEntry = await prismadb.ledgerEntry.findFirst({
        where: { bookingId: booking.id, entryType: 'adjustment' },
      })

      expect(ledgerEntry?.amountThb).toBe(5000)
    })

    it('should reject capture on voided preauth', async () => {
      const { admin, unit, booking } = await bookingWithDeposit('preauth', 5000)
      await scheduleDepositPreAuth(booking.id, unit.id)

      await voidDepositPreAuth(booking.id)

      const claim = await prismadb.depositClaim.create({
        data: {
          bookingId: booking.id,
          claimantIdentityId: admin.id,
          description: 'Damage',
          claimedAmountThb: 2000,
          status: 'filed',
          filedAt: new Date(),
        },
      })

      await expect(captureDepositPreAuth(booking.id, claim.id, 2000)).rejects.toThrow(
        'Deposit preauth was already voided'
      )
    })

    it('should reject a second capture on the same preauth', async () => {
      const { admin, unit, booking } = await bookingWithDeposit('preauth', 5000)
      await scheduleDepositPreAuth(booking.id, unit.id)

      const claim = await prismadb.depositClaim.create({
        data: {
          bookingId: booking.id,
          claimantIdentityId: admin.id,
          description: 'Damage',
          claimedAmountThb: 2000,
          status: 'filed',
          filedAt: new Date(),
        },
      })

      await captureDepositPreAuth(booking.id, claim.id, 2000)

      await expect(captureDepositPreAuth(booking.id, claim.id, 2000)).rejects.toThrow(
        'Deposit preauth was already captured'
      )
    })

    it('should reject capture when the booking has no preauth', async () => {
      const { admin, booking } = await bookingWithDeposit('off')

      const claim = await prismadb.depositClaim.create({
        data: {
          bookingId: booking.id,
          claimantIdentityId: admin.id,
          description: 'Damage',
          claimedAmountThb: 2000,
          status: 'filed',
          filedAt: new Date(),
        },
      })

      await expect(captureDepositPreAuth(booking.id, claim.id, 2000)).rejects.toThrow(
        'No deposit preauth found for this booking'
      )
    })
  })
})
