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
