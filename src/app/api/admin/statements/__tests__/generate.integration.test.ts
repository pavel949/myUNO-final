/* eslint-disable no-restricted-imports */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  db,
  resetDb,
  setGlobalConfig,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util'

const mockGetCurrentUser = vi.fn()
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util')
  return { prisma: util.db }
})

import { POST as generatePost } from '../generate/route'
import { GET as getLineItems } from '../[statementId]/line-items/route'
import { PUT as signOff } from '../[statementId]/sign-off/route'
import { GET as getOwnerStatements } from '../../../owner/statements/route'

// The service fee is a registered business rule, not a literal in the route
// (doc 04 `finance.statement.service_fee_pct`). The test pins the rate it
// asserts on so a founder edit to the default can never break the test.
const SERVICE_FEE_PCT = 12

function currentUser(
  identity: { id: string; email: string | null },
  isAdmin: boolean
) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'Test',
    lastName: 'User',
    isAdmin,
    roles: [],
  }
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/statements/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function get(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' })
}

function put(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/statements/x/sign-off', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Owner Statement Generation', () => {
  let admin: Awaited<ReturnType<typeof createIdentity>>
  let owner: Awaited<ReturnType<typeof createIdentity>>
  let testProject: Awaited<ReturnType<typeof createProject>>
  let testUnit: Awaited<ReturnType<typeof createUnit>>
  let testBooking: Awaited<ReturnType<typeof createBooking>>
  let statementId: string

  const periodStart = new Date('2026-07-01')
  const periodEnd = new Date('2026-07-31')

  beforeAll(async () => {
    await resetDb()
    await setGlobalConfig('finance.statement.service_fee_pct', SERVICE_FEE_PCT)

    admin = await createIdentity({ isAdmin: true })
    owner = await createIdentity({ firstName: 'Test', lastName: 'Owner' })

    testProject = await createProject({ name: 'Test Project' })
    testUnit = await createUnit({
      projectId: testProject.id,
      ownerIdentityId: owner.id,
      name: 'Test Unit',
    })

    // Direct-managed units need their NOI cap before a statement may be
    // generated (money rules, doc 10).
    await db.unitEngagement.create({
      data: {
        unitId: testUnit.id,
        ownerIdentityId: owner.id,
        engagementType: 'direct_managed',
        status: 'active',
        noiCapAnnualThb: 1_000_000,
      },
    })

    testBooking = await createBooking({
      unitId: testUnit.id,
      projectId: testProject.id,
      guestIdentityId: owner.id,
      startDate: periodStart,
      endDate: periodEnd,
      status: 'confirmed',
      totalThb: 50_000,
    })

    await db.payment.create({
      data: {
        purpose: 'stay',
        bookingId: testBooking.id,
        payerIdentityId: owner.id,
        method: 'cash',
        provider: 'cash',
        amountThb: 50_000,
        status: 'succeeded',
        succeededAt: new Date(),
      },
    })

    // A deposit payment attached to the same reservation is not rental cash.
    await db.payment.create({
      data: {
        purpose: 'deposit_preauth', bookingId: testBooking.id,
        payerIdentityId: owner.id, method: 'cash', provider: 'cash',
        amountThb: 2_000, status: 'succeeded', succeededAt: new Date(),
      },
    })

    // A second captured charge requiring reconciliation is not owner income,
    // even when attached to a valid confirmed booking.
    await db.payment.create({ data: {
      purpose: 'stay', bookingId: testBooking.id, payerIdentityId: owner.id,
      method: 'card_provider', provider: 'opn', amountThb: 50_000,
      status: 'succeeded', succeededAt: new Date(), reconciliationReason: 'INITIAL_PAYMENT_ALREADY_RECEIVED',
    } })

    mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))
  })

  it('should validate required fields', async () => {
    const res = await generatePost(post({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing required fields')
  })

  it('should handle non-existent unit', async () => {
    const res = await generatePost(
      post({
        unitId: 'non-existent-id',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      })
    )
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('Unit not found')
  })

  it('should generate statement with valid data', async () => {
    const res = await generatePost(
      post({
        unitId: testUnit.id,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      })
    )
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statement).toBeDefined()
    expect(data.statement.grossBookingsAmountThb).toBe(50_000)
    expect(data.statement.guestPaymentsReceivedThb).toBe(50_000)
    expect(data.statement.status).toBe('draft')

    statementId = data.statement.id
  })

  it('should write statement line items on generation', async () => {
    const stored = await db.statementLineItem.findMany({
      where: { statementId },
    })
    expect(stored.length).toBeGreaterThan(0)
    expect(stored.some((line) => line.category === 'booking_revenue')).toBe(true)
    expect(stored.some((line) => line.category === 'service_fee')).toBe(true)
    // Revenue lines trace back to the booking they came from.
    expect(
      stored.find((line) => line.category === 'booking_revenue')?.bookingId
    ).toBe(testBooking.id)
  })

  it('should not allow duplicate statements for same period', async () => {
    const res = await generatePost(
      post({
        unitId: testUnit.id,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      })
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('already exists')
  })

  it('should retrieve line items by category', async () => {
    const res = await getLineItems(
      get(`http://localhost/api/admin/statements/${statementId}/line-items`),
      { params: { statementId } }
    )
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.lineItems).toBeDefined()
    expect(data.lineItems.length).toBeGreaterThan(0)
    expect(data.groupedByCategory).toBeDefined()
    expect(data.totals).toBeDefined()

    // Should have booking_revenue and service_fee line items
    expect(data.groupedByCategory.booking_revenue).toBeDefined()
    expect(data.groupedByCategory.service_fee).toBeDefined()
  })

  it('should calculate line item totals correctly', async () => {
    const res = await getLineItems(
      get(`http://localhost/api/admin/statements/${statementId}/line-items`),
      { params: { statementId } }
    )
    const data = await res.json()

    // Gross bookings = 50000
    // Service fee = 12% = 6000
    expect(data.totals.booking_revenue).toBe(50_000)
    expect(data.totals.service_fee).toBe(
      Math.round((50_000 * SERVICE_FEE_PCT) / 100)
    )
  })

  it('should allow owner to sign off', async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser(owner, false))

    const res = await signOff(put({ actor: 'owner' }), {
      params: { statementId },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statement.signedOffByOwnerAt).toBeTruthy()
  })

  it('should allow operator to sign off', async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))

    const res = await signOff(put({ actor: 'operator' }), {
      params: { statementId },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statement.signedOffByOperatorAt).toBeTruthy()
    expect(data.statement.status).toBe('signed_off')
  })

  it('should prevent duplicate owner sign-off', async () => {
    const res = await signOff(put({ actor: 'owner' }), {
      params: { statementId },
    })

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('already signed')
  })

  it('should list owner statements', async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser(owner, false))

    const res = await getOwnerStatements(
      get('http://localhost/api/owner/statements')
    )
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statements).toBeDefined()
    expect(Array.isArray(data.statements)).toBe(true)

    // Should contain our generated statement
    const found = data.statements.find((s: any) => s.id === statementId)
    expect(found).toBeDefined()
    expect(found.status).toBe('signed_off')
  })

  it('should handle non-existent statement', async () => {
    mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))

    const res = await getLineItems(
      get('http://localhost/api/admin/statements/non-existent-id/line-items'),
      { params: { statementId: 'non-existent-id' } }
    )

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('not found')
  })
})

// Ported from the now-deleted src/modules/finance/statement.service.ts and
// its test suite (T-030) — that module computed revenue from ledger entries
// via recordBookingRevenue(), a write path nothing in production ever calls;
// this route reads gross revenue from Booking.totalThb directly, which is
// what real bookings actually produce. Same split formulas, same golden
// numbers, exercised through the code path that is actually live.
describe('Owner Statement Generation — golden numbers', () => {
  async function setUp(engagementType: 'direct_managed' | 'via_management_company' | 'owner_direct', noiCapAnnualThb?: number) {
    const admin = await createIdentity({ isAdmin: true })
    const owner = await createIdentity()
    const project = await createProject()
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id })
    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType,
        status: 'active',
        ...(noiCapAnnualThb !== undefined ? { noiCapAnnualThb } : {}),
      },
    })
    mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))
    return { admin, owner, project, unit }
  }

  async function generate(unitId: string, periodStart: string, periodEnd: string) {
    const res = await generatePost(post({ unitId, periodStart, periodEnd }))
    const body = await res.json()
    return { res, body }
  }

  it('generates a statement with NOI above cap: cap bites', async () => {
    await resetDb()
    await setGlobalConfig('finance.statement.service_fee_pct', 0)
    const { owner, project, unit } = await setUp('direct_managed', 10_000)

    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: owner.id,
      startDate: new Date('2026-07-05'),
      endDate: new Date('2026-07-10'),
      status: 'confirmed',
      totalThb: 10_000,
    })
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: owner.id,
      startDate: new Date('2026-07-15'),
      endDate: new Date('2026-07-20'),
      status: 'confirmed',
      totalThb: 5_000,
    })
    const staff = await createIdentity()
    await db.ledgerEntry.create({
      data: {
        unitId: unit.id,
        entryType: 'cleaning_cost',
        amountThb: -2000,
        occurredOn: new Date('2026-07-25'),
        description: 'Post-checkout clean',
        createdByIdentityId: staff.id,
      },
    })

    const { res, body } = await generate(unit.id, '2026-07-01', '2026-07-31')
    expect(res.status).toBe(200)

    // Revenue 15000, costs 2000, NOI 13000; cap pro-rata (10000*31/365)=849;
    // owner MIN(13000,849)=849; estate MAX(0,13000-849)=12151.
    const statement = await db.ownerStatement.findUnique({ where: { id: body.statement.id } })
    expect(statement!.grossRevenueTh).toBe(15_000)
    expect(statement!.totalCostsTh).toBe(2_000)
    expect(statement!.noiTh).toBe(13_000)
    expect(statement!.capApplied).toBe(true)
    expect(statement!.ownerShareTh).toBe(849)
    expect(statement!.estateShareTh).toBe(12_151)
    expect(statement!.status).toBe('draft')
  })

  it('does not let the cap bite when NOI is below it', async () => {
    await resetDb()
    await setGlobalConfig('finance.statement.service_fee_pct', 0)
    const { owner, project, unit } = await setUp('direct_managed', 100_000)

    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: owner.id,
      startDate: new Date('2026-07-05'),
      endDate: new Date('2026-07-10'),
      status: 'confirmed',
      totalThb: 5_000,
    })
    const staff = await createIdentity()
    await db.ledgerEntry.create({
      data: {
        unitId: unit.id,
        entryType: 'maintenance_cost',
        amountThb: -1000,
        occurredOn: new Date('2026-07-15'),
        description: 'Repair',
        createdByIdentityId: staff.id,
      },
    })

    const { body } = await generate(unit.id, '2026-07-01', '2026-07-31')
    const statement = await db.ownerStatement.findUnique({ where: { id: body.statement.id } })

    // Cap pro-rata (100000*31/365)=8493; owner MIN(4000,8493)=4000 (no bite).
    expect(statement!.noiTh).toBe(4_000)
    expect(statement!.capApplied).toBe(false)
    expect(statement!.ownerShareTh).toBe(4_000)
    expect(statement!.estateShareTh).toBe(0)
  })

  it('refuses to generate for a direct-managed unit with no NOI cap', async () => {
    await resetDb()
    const { unit } = await setUp('direct_managed')

    const { res, body } = await generate(unit.id, '2026-07-01', '2026-07-31')
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/noi_cap_annual_thb/i)
  })

  it('deducts the MC platform fee for a via_management_company unit', async () => {
    await resetDb()
    await setGlobalConfig('finance.statement.service_fee_pct', 0)
    await setGlobalConfig('engagement.via_mc.platform_fee_pct', 20)
    const { owner, project, unit } = await setUp('via_management_company')

    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: owner.id,
      startDate: new Date('2026-07-05'),
      endDate: new Date('2026-07-15'),
      status: 'confirmed',
      totalThb: 10_000,
    })
    const staff = await createIdentity()
    await db.ledgerEntry.create({
      data: {
        unitId: unit.id,
        entryType: 'utilities_cost',
        amountThb: -1000,
        occurredOn: new Date('2026-07-20'),
        description: 'Water bill',
        createdByIdentityId: staff.id,
      },
    })

    const { body } = await generate(unit.id, '2026-07-01', '2026-07-31')
    const statement = await db.ownerStatement.findUnique({ where: { id: body.statement.id } })

    // NOI 9000; MC fee 9000*20%=1800; owner 9000-1800=7200; estate 1800.
    expect(statement!.noiTh).toBe(9_000)
    expect(statement!.ownerShareTh).toBe(7_200)
    expect(statement!.estateShareTh).toBe(1_800)
    expect(statement!.capApplied).toBe(false)
  })

  it('deducts the booking fee for an owner_direct unit', async () => {
    await resetDb()
    await setGlobalConfig('finance.statement.service_fee_pct', 0)
    await setGlobalConfig('engagement.owner_direct.booking_fee_pct', 5)
    const { owner, project, unit } = await setUp('owner_direct')

    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: owner.id,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-10'),
      status: 'confirmed',
      totalThb: 12_000,
    })
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: owner.id,
      startDate: new Date('2026-07-20'),
      endDate: new Date('2026-07-28'),
      status: 'confirmed',
      totalThb: 8_000,
    })
    const staff = await createIdentity()
    await db.ledgerEntry.create({
      data: {
        unitId: unit.id,
        entryType: 'cleaning_cost',
        amountThb: -2000,
        occurredOn: new Date('2026-07-30'),
        description: 'Cleans',
        createdByIdentityId: staff.id,
      },
    })

    const { body } = await generate(unit.id, '2026-07-01', '2026-07-31')
    const statement = await db.ownerStatement.findUnique({ where: { id: body.statement.id } })

    // NOI 18000; booking fee 18000*5%=900; owner 18000-900=17100; estate 900.
    expect(statement!.noiTh).toBe(18_000)
    expect(statement!.ownerShareTh).toBe(17_100)
    expect(statement!.estateShareTh).toBe(900)
    expect(statement!.capApplied).toBe(false)
  })
  it('refuses to silently omit a stay crossing the statement period', async () => {
    await resetDb()
    const { owner, project, unit } = await setUp('owner_direct')
    await createBooking({
      unitId: unit.id, projectId: project.id, guestIdentityId: owner.id,
      startDate: new Date('2026-06-29'), endDate: new Date('2026-07-04'),
      status: 'confirmed', totalThb: 12_000,
    })
    const { res, body } = await generate(unit.id, '2026-07-01', '2026-07-31')
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/crosses this accounting period/i)
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(0)
  })

  it('includes expenses occurring during the final calendar day', async () => {
    await resetDb()
    await setGlobalConfig('finance.statement.service_fee_pct', 0)
    await setGlobalConfig('engagement.owner_direct.booking_fee_pct', 0)
    const { owner, project, unit } = await setUp('owner_direct')
    const staff = await createIdentity()
    await createBooking({
      unitId: unit.id, projectId: project.id, guestIdentityId: owner.id,
      startDate: new Date('2026-07-01'), endDate: new Date('2026-07-05'),
      status: 'confirmed', totalThb: 10_000,
    })
    await db.ledgerEntry.create({
      data: {
        unitId: unit.id, entryType: 'cleaning_cost', amountThb: -1_000,
        occurredOn: new Date('2026-07-31T16:30:00.000Z'),
        description: 'End-of-period clean', createdByIdentityId: staff.id,
      },
    })
    const { res, body } = await generate(unit.id, '2026-07-01', '2026-07-31')
    expect(res.status).toBe(200)
    expect(body.statement.operatingExpensesAmountThb).toBe(1_000)
  })

})

describe('Owner Statement Generation — distinct period overlap guard', () => {
  // Pause the first real insert after its overlap query, while it still owns
  // the transaction's ledger lock. The competing request must either wait on
  // that exact PostgreSQL lock or reach a second insert (a broken-lock path).
  let insertGate: {
    unitId: string
    count: number
    entered: () => void
    released: Promise<void>
  } | null = null
  db.$use(async (params, next) => {
    if (
      insertGate && params.model === 'OwnerStatement' &&
      params.action === 'create' && params.args.data.unitId === insertGate.unitId
    ) {
      const gate = insertGate
      gate.count++
      if (gate.count === 1) {
        gate.entered()
        await gate.released
      }
    }
    return next(params)
  })

  async function waitForOtherWriter(unitId: string, gate: NonNullable<typeof insertGate>) {
    const lockKey = 'unit-ledger:' + unitId
    const deadline = Date.now() + 4_000
    while (gate.count < 2) {
      // A pool that cannot admit the observer must fail within the deadline,
      // rather than hanging while the first writer is deliberately paused.
      const [row] = await db.$transaction(tx => tx.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM pg_locks
            WHERE locktype = 'advisory' AND mode = 'ExclusiveLock'
              AND NOT granted AND objsubid = 1
              AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
              AND classid = (((hashtextextended(${lockKey}, 0) >> 32) & 4294967295)::oid)
              AND objid = ((hashtextextended(${lockKey}, 0) & 4294967295)::oid)
          ) AS waiting
        `, { maxWait: 1_000, timeout: 2_000 })
      if (row.waiting) return
      if (Date.now() > deadline) {
        throw new Error('The competing statement never reached the insert or unit ledger lock')
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  async function fixture() {
    await resetDb()
    await setGlobalConfig('finance.statement.service_fee_pct', 0)
    const admin = await createIdentity({ isAdmin: true })
    const owner = await createIdentity()
    const project = await createProject()

    async function addUnit() {
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id })
      await db.unitEngagement.create({
        data: {
          unitId: unit.id,
          ownerIdentityId: owner.id,
          engagementType: 'direct_managed',
          status: 'active',
          noiCapAnnualThb: 1_000_000,
        },
      })
      return unit
    }

    mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))
    return { unit: await addUnit(), addUnit }
  }

  async function generate(
    unitId: string,
    periodStart = '2026-07-01',
    periodEnd = '2026-07-31',
    regenerate = false
  ) {
    const res = await generatePost(post({ unitId, periodStart, periodEnd, regenerate }))
    return { res, body: await res.json() }
  }

  it.each([
    ['the first calendar day', '2026-06-15', '2026-07-01'],
    ['the last calendar day', '2026-07-31', '2026-08-15'],
    ['a contained range', '2026-07-10', '2026-07-20'],
    ['a containing range', '2026-06-01', '2026-08-31'],
  ])('refuses a distinct period overlapping %s', async (_case, start, end) => {
    const { unit } = await fixture()
    const original = await generate(unit.id)
    expect(original.res.status).toBe(200)

    const overlap = await generate(unit.id, start, end)
    expect(overlap.res.status).toBe(409)
    expect(overlap.body.code).toBe('statement_period_overlap')
    expect(overlap.body.statementId).toBe(original.body.statement.id)
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(1)
  })

  it('does not let regenerate bypass a distinct overlapping period with the same start', async () => {
    const { unit } = await fixture()
    const original = await generate(unit.id)
    expect(original.res.status).toBe(200)

    const overlap = await generate(unit.id, '2026-07-01', '2026-08-15', true)
    expect(overlap.res.status).toBe(409)
    expect(overlap.body.code).toBe('statement_period_overlap')
    expect(overlap.body.statementId).toBe(original.body.statement.id)
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(1)
  })

  it('allows adjacent periods that share no inclusive calendar day', async () => {
    const { unit } = await fixture()
    expect((await generate(unit.id)).res.status).toBe(200)
    expect((await generate(unit.id, '2026-06-01', '2026-06-30')).res.status).toBe(200)
    expect((await generate(unit.id, '2026-08-01', '2026-08-31')).res.status).toBe(200)
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(3)
  })

  it('does not confuse another unit with an overlapping period', async () => {
    const { unit, addUnit } = await fixture()
    const otherUnit = await addUnit()
    expect((await generate(unit.id)).res.status).toBe(200)
    expect((await generate(otherUnit.id, '2026-07-10', '2026-07-20')).res.status).toBe(200)
    expect(await db.ownerStatement.count({ where: { unitId: otherUnit.id } })).toBe(1)
  })

  it('ignores a superseded period while preserving its historical row', async () => {
    const { unit } = await fixture()
    const original = await generate(unit.id)
    expect(original.res.status).toBe(200)
    await db.ownerStatement.update({
      where: { id: original.body.statement.id },
      data: { status: 'superseded' },
    })

    const replacement = await generate(unit.id, '2026-07-10', '2026-07-20')
    expect(replacement.res.status).toBe(200)
    expect(replacement.body.statement.id).not.toBe(original.body.statement.id)
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(2)
    expect((await db.ownerStatement.findUniqueOrThrow({
      where: { id: original.body.statement.id },
    })).status).toBe('superseded')
  })

  it('keeps exact-period duplicates refused and rebuilds an unsigned draft in place', async () => {
    const { unit } = await fixture()
    const original = await generate(unit.id)
    expect(original.res.status).toBe(200)

    const duplicate = await generate(unit.id)
    expect(duplicate.res.status).toBe(409)
    expect(duplicate.body.error).toContain('already exists')
    expect(duplicate.body.code).not.toBe('statement_period_overlap')

    const rebuilt = await generate(unit.id, '2026-07-01', '2026-07-31', true)
    expect(rebuilt.res.status).toBe(200)
    expect(rebuilt.body.regenerated).toBe(true)
    expect(rebuilt.body.statement.id).toBe(original.body.statement.id)
    expect(rebuilt.body.supersededStatementId).toBeNull()
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(1)
  })

  it.each(['published', 'pending_owner_review'] as const)(
    'preserves exact-period replacement of an unsigned %s report',
    async status => {
      const { unit } = await fixture()
      const original = await generate(unit.id)
      expect(original.res.status).toBe(200)
      await db.ownerStatement.update({
        where: { id: original.body.statement.id },
        data: {
          status,
          signedOffByOperatorAt: new Date('2026-08-01T00:00:00.000Z'),
          signedOffByOwnerAt: null,
        },
      })

      const replacement = await generate(unit.id, '2026-07-01', '2026-07-31', true)
      expect(replacement.res.status).toBe(200)
      expect(replacement.body.statement.id).not.toBe(original.body.statement.id)
      expect(replacement.body.supersededStatementId).toBe(original.body.statement.id)
      const old = await db.ownerStatement.findUniqueOrThrow({
        where: { id: original.body.statement.id },
      })
      expect(old.status).toBe('superseded')
      expect(await db.ownerStatement.count({
        where: { unitId: unit.id, status: { not: 'superseded' } },
      })).toBe(1)
    }
  )

  it('continues to refuse exact-period regeneration after owner sign-off', async () => {
    const { unit } = await fixture()
    const original = await generate(unit.id)
    expect(original.res.status).toBe(200)
    await db.ownerStatement.update({
      where: { id: original.body.statement.id },
      data: {
        status: 'signed_off',
        signedOffByOwnerAt: new Date('2026-08-01T00:00:00.000Z'),
        signedOffByOperatorAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    })

    const refused = await generate(unit.id, '2026-07-01', '2026-07-31', true)
    expect(refused.res.status).toBe(409)
    expect(refused.body.code).toBe('statement_not_regenerable')
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(1)
  })

  it('serializes two concurrent overlapping requests and commits only one statement', async () => {
    const { unit } = await fixture()
    let enter!: () => void
    let release!: () => void
    const entered = new Promise<void>(resolve => { enter = resolve })
    const released = new Promise<void>(resolve => { release = resolve })
    const gate = { unitId: unit.id, count: 0, entered: enter, released }
    insertGate = gate
    const first = generate(unit.id, '2026-07-01', '2026-07-31')
    let second: ReturnType<typeof generate> | undefined
    let readyTimer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        entered,
        first.then(() => { throw new Error('The first statement never reached the insert barrier') }),
        new Promise<void>((_, reject) => {
          readyTimer = setTimeout(() => reject(new Error('The first statement insert barrier timed out')), 4_000)
        }),
      ])
      clearTimeout(readyTimer)
      second = generate(unit.id, '2026-07-15', '2026-08-15')
      await waitForOtherWriter(unit.id, gate)
    } finally {
      clearTimeout(readyTimer)
      release()
      await Promise.allSettled(second ? [first, second] : [first])
      insertGate = null
    }
    const outcomes = await Promise.all([first, second!])
    expect(outcomes.map(({ res }) => res.status).sort((a, b) => a - b)).toEqual([200, 409])
    const successful = outcomes.find(({ res }) => res.status === 200)!
    const refused = outcomes.find(({ res }) => res.status === 409)!
    expect(refused.body.code).toBe('statement_period_overlap')
    expect(refused.body.statementId).toBe(successful.body.statement.id)
    expect(await db.ownerStatement.count({ where: { unitId: unit.id } })).toBe(1)
  })
})
