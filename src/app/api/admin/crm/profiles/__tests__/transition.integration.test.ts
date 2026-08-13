import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { POST } from '../[profileId]/transition/route'
import prismadb from '@/app/libs/prismadb'
import { NextRequest } from 'next/server'

describe('CRM Lifecycle Transition API', () => {
  let testProfile: any
  let testIdentity: any

  beforeAll(async () => {
    // Create test identity (admin)
    testIdentity = await prismadb.identity.create({
      data: {
        email: `admin-${Date.now()}@test.local`,
        first_name: 'Test',
        last_name: 'Admin',
      },
    })

    // Create test CRM profile
    testProfile = await prismadb.crm_profile.create({
      data: {
        identity_id: testIdentity.id,
        lifecycle_stage: 'contact',
        lead_score: 0,
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    if (testProfile?.id) {
      // @ts-ignore
      await prismadb.crm_lifecycle_transition.deleteMany({
        where: { profile_id: testProfile.id },
      })
      await prismadb.crm_profile.delete({
        where: { id: testProfile.id },
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
        // missing to_stage and reason
      }),
    })

    const res = await POST(req, { params: { profileId: testProfile.id } })
    expect(res.status).toBe(400)
  })

  it('should reject invalid transitions', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({
        to_stage: 'owner', // can't go from 'contact' to 'owner'
        reason: 'Test invalid transition',
      }),
    })

    const res = await POST(req, { params: { profileId: testProfile.id } })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid transition')
  })

  it('should allow valid transition from contact to guest', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({
        to_stage: 'guest',
        reason: 'Guest completed first booking',
      }),
    })

    const res = await POST(req, { params: { profileId: testProfile.id } })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.profile.lifecycle_stage).toBe('guest')
  })

  it('should create audit log entry', async () => {
    // Transition to guest first
    await POST(
      new NextRequest('http://localhost:3000', {
        method: 'POST',
        body: JSON.stringify({
          to_stage: 'guest',
          reason: 'First booking',
        }),
      }),
      { params: { profileId: testProfile.id } }
    )

    // Now transition to repeat_guest
    await POST(
      new NextRequest('http://localhost:3000', {
        method: 'POST',
        body: JSON.stringify({
          to_stage: 'repeat_guest',
          reason: 'Second booking within 12 months',
        }),
      }),
      { params: { profileId: testProfile.id } }
    )

    // Verify audit logs exist
    // @ts-ignore
    const transitions = await prismadb.crm_lifecycle_transition.findMany({
      where: { profile_id: testProfile.id },
    })

    expect(transitions.length).toBeGreaterThan(0)
    expect(transitions[0].from_stage).toBe('contact')
    expect(transitions[0].to_stage).toBe('guest')
  })

  it('should handle non-existent profile', async () => {
    const req = new NextRequest('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({
        to_stage: 'guest',
        reason: 'Test',
      }),
    })

    const res = await POST(req, { params: { profileId: 'non-existent-id' } })
    expect(res.status).toBe(404)
  })
})
