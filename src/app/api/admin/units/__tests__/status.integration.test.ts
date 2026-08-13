/* eslint-disable no-restricted-imports */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PUT } from '../[id]/status/route'
import prismadb from '@/app/libs/prismadb'
import { NextRequest } from 'next/server'

describe('Unit Asset Status API', () => {
  let testUnit: any
  let testProject: any
  let testIdentity: any

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
  })

  afterAll(async () => {
    // Cleanup
    if (testUnit?.id) {
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
      method: 'PUT',
      body: JSON.stringify({
        // missing status and reason
      }),
    })

    const res = await PUT(req, { params: { id: testUnit.id } })
    expect(res.status).toBe(400)
  })

  it('should reject invalid status', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'invalid_status',
        reason: 'Test',
      }),
    })

    const res = await PUT(req, { params: { id: testUnit.id } })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid status')
  })

  it('should allow valid status change to verified_partner', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'verified_partner',
        reason: 'Partnered with external operator',
      }),
    })

    const res = await PUT(req, { params: { id: testUnit.id } })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.unit.asset_status).toBe('verified_partner')
  })

  it('should allow valid status change to suspended', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'suspended',
        reason: 'Maintenance period',
      }),
    })

    const res = await PUT(req, { params: { id: testUnit.id } })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.unit.asset_status).toBe('suspended')
    expect(data.previousStatus).toBe('verified_partner')
  })

  it('should track status change timestamp', async () => {
    const beforeChange = new Date()

    await PUT(
      new NextRequest('http://localhost:3000', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'managed',
          reason: 'Back to managed',
        }),
      }),
      { params: { unitId: testUnit.id } }
    )

    const updatedUnit = await prismadb.unit.findUnique({
      where: { id: testUnit.id },
    })

    expect(updatedUnit?.asset_status_changed_at).toBeDefined()
    if (updatedUnit?.asset_status_changed_at) {
      const changeTime = new Date(updatedUnit.asset_status_changed_at)
      expect(changeTime.getTime()).toBeGreaterThanOrEqual(beforeChange.getTime() - 1000) // 1s buffer
    }
  })

  it('should handle non-existent unit', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'managed',
        reason: 'Test',
      }),
    })

    const res = await PUT(req, { params: { unitId: 'non-existent-id' } })
    expect(res.status).toBe(404)
  })
})
