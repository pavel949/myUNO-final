/* eslint-disable no-restricted-imports */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { POST as generatePost } from '../generate/route'
import { GET as getLineItems } from '../../[statementId]/line-items/route'
import { PUT as signOff } from '../../[statementId]/sign-off/route'
import { GET as getOwnerStatements } from '../../../owner/statements/route'
import prismadb from '@/app/libs/prismadb'
import { NextRequest } from 'next/server'

describe('Owner Statement Generation', () => {
  let testUnit: any
  let testProject: any
  let testIdentity: any
  let testBooking: any
  let statementId: string

  beforeAll(async () => {
    // Create test identity (owner)
    testIdentity = await prismadb.identity.create({
      data: {
        email: `owner-${Date.now()}@test.local`,
        first_name: 'Test',
        last_name: 'Owner',
      },
    })

    // Create test project
    testProject = await prismadb.project.create({
      data: {
        name: 'Test Project',
        brand_code: `TEST_${Date.now()}`,
        location_value: 'TH',
        owner_identity_id: testIdentity.id,
      },
    })

    // Create test unit
    testUnit = await prismadb.unit.create({
      data: {
        title: 'Test Unit',
        project_id: testProject.id,
        owner_identity_id: testIdentity.id,
      },
    })

    // Create engagement for the unit
    await prismadb.unitEngagement.create({
      data: {
        unit_id: testUnit.id,
        engagement_type: 'direct_managed',
        status: 'active',
        noi_cap_annual_thb: 1000000,
      },
    })

    // Create test booking for the statement period
    const periodStart = new Date('2026-07-01')
    const periodEnd = new Date('2026-07-31')
    testBooking = await prismadb.booking.create({
      data: {
        unit_id: testUnit.id,
        project_id: testProject.id,
        guest_identity_id: testIdentity.id,
        booking_type: 'stay',
        channel: 'direct',
        status: 'confirmed',
        start_date: periodStart,
        end_date: periodEnd,
        adults: 2,
        children: 0,
        total_thb: 50000,
      },
    })

    // Add payment to booking
    await prismadb.payment.create({
      data: {
        purpose: 'stay',
        booking_id: testBooking.id,
        payer_identity_id: testIdentity.id,
        method: 'cash',
        provider: 'cash',
        amount_thb: 50000,
        status: 'succeeded',
        succeeded_at: new Date(),
      },
    })
  })

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (testBooking?.id) {
      await prismadb.booking.deleteMany({
        where: { id: testBooking.id },
      })
    }
    if (testUnit?.id) {
      await prismadb.unitEngagement.deleteMany({
        where: { unit_id: testUnit.id },
      })
      await prismadb.unit.delete({
        where: { id: testUnit.id },
      })
    }
    if (testProject?.id) {
      await prismadb.project.delete({
        where: { id: testProject.id },
      })
    }
    if (testIdentity?.id) {
      await prismadb.identity.delete({
        where: { id: testIdentity.id },
      })
    }
  })

  it('should validate required fields', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({
        // missing unitId, periodStart, periodEnd
      }),
    })

    const res = await generatePost(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing required fields')
  })

  it('should handle non-existent unit', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({
        unitId: 'non-existent-id',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }),
    })

    const res = await generatePost(req)
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('Unit not found')
  })

  it('should generate statement with valid data', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({
        unitId: testUnit.id,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }),
    })

    const res = await generatePost(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statement).toBeDefined()
    expect(data.statement.grossBookingsAmountThb).toBe(50000)
    expect(data.statement.guestPaymentsReceivedThb).toBe(50000)
    expect(data.statement.status).toBe('draft')

    statementId = data.statement.id
  })

  it('should not allow duplicate statements for same period', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({
        unitId: testUnit.id,
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }),
    })

    const res = await generatePost(req)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('already exists')
  })

  it('should retrieve line items by category', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'GET',
    })

    const res = await getLineItems(req, {
      params: { statementId },
    })
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
    const req = new NextRequest('http://localhost:3000', {
      method: 'GET',
    })

    const res = await getLineItems(req, {
      params: { statementId },
    })
    const data = await res.json()

    // Gross bookings = 50000
    // Service fee = 12% = 6000
    expect(data.totals.booking_revenue).toBe(50000)
    expect(data.totals.service_fee).toBe(6000)
  })

  it('should allow owner to sign off', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'PUT',
      body: JSON.stringify({
        actor: 'owner',
      }),
    })

    // Mock getCurrentUser to return the owner
    const originalModule = await import('@/app/actions/getCurrentUser')
    const originalGetCurrentUser = originalModule.getCurrentUser
    ;(originalModule as any).getCurrentUser = async () => ({
      id: testIdentity.id,
      email: testIdentity.email,
      role: 'user',
    })

    const res = await signOff(req, {
      params: { statementId },
    })

    // Restore original function
    ;(originalModule as any).getCurrentUser = originalGetCurrentUser

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statement.signedOffByOwnerAt).toBeDefined()
  })

  it('should allow operator to sign off', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'PUT',
      body: JSON.stringify({
        actor: 'operator',
      }),
    })

    const res = await signOff(req, {
      params: { statementId },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statement.signedOffByOperatorAt).toBeDefined()
    expect(data.statement.status).toBe('signed_off')
  })

  it('should prevent duplicate owner sign-off', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'PUT',
      body: JSON.stringify({
        actor: 'owner',
      }),
    })

    const res = await signOff(req, {
      params: { statementId },
    })

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('already signed')
  })

  it('should list owner statements', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'GET',
    })

    const res = await getOwnerStatements(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statements).toBeDefined()
    expect(Array.isArray(data.statements)).toBe(true)

    // Should contain our generated statement
    const found = data.statements.find(
      (s: any) => s.id === statementId
    )
    expect(found).toBeDefined()
    expect(found.status).toBe('signed_off')
  })

  it('should handle non-existent statement', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'GET',
    })

    const res = await getLineItems(req, {
      params: { statementId: 'non-existent-id' },
    })

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('not found')
  })
})
