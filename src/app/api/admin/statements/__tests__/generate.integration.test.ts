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
})
