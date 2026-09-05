import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util'

const mockGetCurrentUser = vi.fn()
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

// The route reaches the database through the app's prisma singleton; point it
// at the test client so it sees the rows the factories create.
vi.mock('@/app/libs/prismadb', async () => {
  const util = await import('@/test/util')
  return { default: util.db, db: util.db }
})

import { PUT } from '@/app/api/admin/units/[id]/status/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/units/x/status', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Unit Asset Status API', () => {
  let testUnit: Awaited<ReturnType<typeof createUnit>>
  let admin: Awaited<ReturnType<typeof createIdentity>>

  beforeEach(async () => {
    await resetDb()

    admin = await createIdentity({ firstName: 'Test', lastName: 'Admin', isAdmin: true })
    const project = await createProject({ status: 'live' })
    testUnit = await createUnit({ projectId: project.id, ownerIdentityId: admin.id })

    mockGetCurrentUser.mockResolvedValue({
      identityId: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      isAdmin: true,
      roles: [],
    })
  })

  it('should validate required fields', async () => {
    const res = await PUT(makeRequest({}), { params: { id: testUnit.id } })

    expect(res.status).toBe(400)
  })

  it('should reject invalid status', async () => {
    const res = await PUT(makeRequest({ status: 'invalid_status', reason: 'Test' }), {
      params: { id: testUnit.id },
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid status')
  })

  it('should allow valid status change to verified_partner', async () => {
    const res = await PUT(
      makeRequest({ status: 'verified_partner', reason: 'Partnered with external operator' }),
      { params: { id: testUnit.id } }
    )

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.unit.assetStatus).toBe('verified_partner')
    expect(data.unit.assetStatusReason).toBe('Partnered with external operator')
  })

  it('should allow valid status change to suspended', async () => {
    await PUT(makeRequest({ status: 'verified_partner', reason: 'Partnered' }), {
      params: { id: testUnit.id },
    })

    const res = await PUT(makeRequest({ status: 'suspended', reason: 'Maintenance period' }), {
      params: { id: testUnit.id },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.unit.assetStatus).toBe('suspended')
    // The route reports the status it moved away from in its message.
    expect(data.message).toContain('verified_partner')
  })

  it('should track status change timestamp', async () => {
    const beforeChange = new Date()

    const res = await PUT(makeRequest({ status: 'managed', reason: 'Back to managed' }), {
      params: { id: testUnit.id },
    })
    expect(res.status).toBe(200)

    const updatedUnit = await db.unit.findUnique({ where: { id: testUnit.id } })

    expect(updatedUnit?.assetStatusChangedAt).toBeDefined()
    expect(updatedUnit?.assetStatusChangedAt).not.toBeNull()
    const changeTime = new Date(updatedUnit!.assetStatusChangedAt!)
    expect(changeTime.getTime()).toBeGreaterThanOrEqual(beforeChange.getTime() - 1000) // 1s buffer
  })

  it('should handle non-existent unit', async () => {
    const res = await PUT(makeRequest({ status: 'managed', reason: 'Test' }), {
      params: { id: 'non-existent-id' },
    })

    expect(res.status).toBe(404)
  })

  it('should refuse a non-admin caller', async () => {
    const staff = await createIdentity({ firstName: 'Not', lastName: 'Admin' })
    mockGetCurrentUser.mockResolvedValue({
      identityId: staff.id,
      email: staff.email,
      firstName: staff.firstName,
      lastName: staff.lastName,
      isAdmin: false,
      roles: [],
    })

    const res = await PUT(makeRequest({ status: 'suspended', reason: 'Test' }), {
      params: { id: testUnit.id },
    })

    expect(res.status).toBe(403)
  })
})
