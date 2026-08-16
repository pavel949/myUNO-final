import { describe, it, expect, beforeEach } from 'vitest'
import prismadb from '@/app/libs/prismadb'
import { resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util'
import { initiateDepositPreAuth, voidDepositPreAuth, captureDepositPreAuth } from '@/app/libs/deposits'

describe('T-032: Deposits & Damage Claims', () => {
  beforeEach(async () => {
    await resetDb()
  })

  describe('Deposit Pre-Auth', () => {
    it('should initiate deposit preauth when mode=preauth and amount > 0', async () => {
      const guest = await createIdentity()
      const project = await createProject()
      const unit = await createUnit(project.id)

      // Set config for preauth
      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.mode',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 'preauth',
          updatedByIdentityId: 'test',
        },
      })

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.amount_thb',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 10000,
          updatedByIdentityId: 'test',
        },
      })

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      })

      // Initiate preauth
      const paymentId = await initiateDepositPreAuth(booking.id, unit.id, guest.id)

      expect(paymentId).toBeDefined()
      expect(paymentId).not.toBeNull()

      // Verify payment was created
      const payment = await prismadb.payment.findUnique({
        where: { id: paymentId! },
      })

      expect(payment).toBeDefined()
      expect(payment?.purpose).toBe('deposit_preauth')
      expect(payment?.amountThb).toBe(10000)
      expect(payment?.status).toBe('pending')
      expect(payment?.bookingId).toBe(booking.id)
    })

    it('should not initiate preauth when mode=off', async () => {
      const guest = await createIdentity()
      const project = await createProject()
      const unit = await createUnit(project.id)

      // Set config to off (default)
      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.mode',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 'off',
          updatedByIdentityId: 'test',
        },
      })

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      })

      // Try to initiate preauth
      const paymentId = await initiateDepositPreAuth(booking.id, unit.id, guest.id)

      expect(paymentId).toBeNull()
    })
  })

  describe('Void on clean checkout', () => {
    it('should void deposit preauth on clean checkout', async () => {
      const guest = await createIdentity()
      const project = await createProject()
      const unit = await createUnit(project.id)

      // Set config for preauth
      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.mode',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 'preauth',
          updatedByIdentityId: 'test',
        },
      })

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.amount_thb',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 5000,
          updatedByIdentityId: 'test',
        },
      })

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      })
      const paymentId = await initiateDepositPreAuth(booking.id, unit.id, guest.id)

      expect(paymentId).not.toBeNull()

      // Void the preauth
      await voidDepositPreAuth(paymentId!)

      // Verify payment status is voided
      const payment = await prismadb.payment.findUnique({
        where: { id: paymentId! },
      })

      expect(payment?.status).toBe('voided')
    })

    it('should not void an already-voided preauth', async () => {
      const guest = await createIdentity()
      const project = await createProject()
      const unit = await createUnit(project.id)

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.mode',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 'preauth',
          updatedByIdentityId: 'test',
        },
      })

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.amount_thb',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 5000,
          updatedByIdentityId: 'test',
        },
      })

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      })
      const paymentId = await initiateDepositPreAuth(booking.id, unit.id, guest.id)

      // Void twice
      await voidDepositPreAuth(paymentId!)
      await voidDepositPreAuth(paymentId!) // Should not throw

      const payment = await prismadb.payment.findUnique({
        where: { id: paymentId! },
      })

      expect(payment?.status).toBe('voided')
    })
  })

  describe('Capture on damage claim', () => {
    it('should capture deposit preauth on damage claim approval', async () => {
      const guest = await createIdentity()
      const admin = await createIdentity()
      const project = await createProject()
      const unit = await createUnit(project.id)

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.mode',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 'preauth',
          updatedByIdentityId: 'test',
        },
      })

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.amount_thb',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 8000,
          updatedByIdentityId: 'test',
        },
      })

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      })
      const paymentId = await initiateDepositPreAuth(booking.id, unit.id, guest.id)

      expect(paymentId).not.toBeNull()

      // File a damage claim
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

      // Capture the preauth
      await captureDepositPreAuth(paymentId!, claim.id, 3000)

      // Verify payment is marked as succeeded
      const payment = await prismadb.payment.findUnique({
        where: { id: paymentId! },
      })

      expect(payment?.status).toBe('succeeded')
      expect(payment?.succeededAt).toBeDefined()

      // Verify ledger entry was created
      const ledgerEntry = await prismadb.ledgerEntry.findFirst({
        where: {
          paymentId: paymentId!,
          entryType: 'adjustment',
        },
      })

      expect(ledgerEntry).toBeDefined()
      expect(ledgerEntry?.amountThb).toBe(3000)
      expect(ledgerEntry?.description).toContain(claim.id)
    })

    it('should cap capture amount at preauth amount', async () => {
      const guest = await createIdentity()
      const admin = await createIdentity()
      const project = await createProject()
      const unit = await createUnit(project.id)

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.mode',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 'preauth',
          updatedByIdentityId: 'test',
        },
      })

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.amount_thb',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 5000,
          updatedByIdentityId: 'test',
        },
      })

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      })
      const paymentId = await initiateDepositPreAuth(booking.id, unit.id, guest.id)

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

      // Try to capture 10000 but preauth is only 5000
      await captureDepositPreAuth(paymentId!, claim.id, 10000)

      // Verify only 5000 was captured
      const ledgerEntry = await prismadb.ledgerEntry.findFirst({
        where: {
          paymentId: paymentId!,
          entryType: 'adjustment',
        },
      })

      expect(ledgerEntry?.amountThb).toBe(5000)
    })

    it('should reject capture on voided preauth', async () => {
      const guest = await createIdentity()
      const admin = await createIdentity()
      const project = await createProject()
      const unit = await createUnit(project.id)

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.mode',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 'preauth',
          updatedByIdentityId: 'test',
        },
      })

      await prismadb.configOverride.create({
        data: {
          parameterKey: 'booking.deposit.amount_thb',
          scopeType: 'unit',
          scopeId: unit.id,
          value: 5000,
          updatedByIdentityId: 'test',
        },
      })

      const booking = await createBooking({
        unitId: unit.id,
        projectId: project.id,
        guestIdentityId: guest.id,
      })
      const paymentId = await initiateDepositPreAuth(booking.id, unit.id, guest.id)

      // Void the preauth
      await voidDepositPreAuth(paymentId!)

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

      // Try to capture voided preauth
      await expect(captureDepositPreAuth(paymentId!, claim.id, 2000)).rejects.toThrow(
        'Deposit preauth was already voided'
      )
    })
  })
})
