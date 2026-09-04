import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { db, resetDb, createIdentity } from '@/test/util'

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

import { POST } from '@/app/api/admin/crm/profiles/[profileId]/transition/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/crm/profiles/x/transition', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('CRM Lifecycle Transition API', () => {
  let testProfile: Awaited<ReturnType<typeof db.crmProfile.create>>
  let admin: Awaited<ReturnType<typeof createIdentity>>

  beforeEach(async () => {
    await resetDb()

    admin = await createIdentity({ firstName: 'Test', lastName: 'Admin', isAdmin: true })

    testProfile = await db.crmProfile.create({
      data: {
        identityId: admin.id,
        lifecycleStage: 'contact',
        leadScore: 0,
      },
    })

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
    const res = await POST(makeRequest({}), { params: { profileId: testProfile.id } })

    expect(res.status).toBe(400)
  })

  it('should reject invalid transitions', async () => {
    const res = await POST(
      // 'contact' may only move to 'guest' or 'prospect'
      makeRequest({ to_stage: 'owner', reason: 'Test invalid transition' }),
      { params: { profileId: testProfile.id } }
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid transition')
  })

  it('should allow valid transition from contact to guest', async () => {
    const res = await POST(
      makeRequest({ to_stage: 'guest', reason: 'Guest completed first booking' }),
      { params: { profileId: testProfile.id } }
    )

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.profile.lifecycleStage).toBe('guest')
    expect(data.profile.lifecycleChangeReason).toBe('Guest completed first booking')
    expect(data.profile.lifecycleChangeApprovedBy).toBe(admin.id)
  })

  it('should create audit log entry', async () => {
    await POST(makeRequest({ to_stage: 'guest', reason: 'First booking' }), {
      params: { profileId: testProfile.id },
    })

    // 'repeat' is the stage a returning guest moves to (enum CrmLifecycleStage)
    await POST(
      makeRequest({ to_stage: 'repeat', reason: 'Second booking within 12 months' }),
      { params: { profileId: testProfile.id } }
    )

    const transitions = await db.lifecycleTransitionLog.findMany({
      where: { profileId: testProfile.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(transitions.length).toBe(2)
    expect(transitions[0].fromStage).toBe('contact')
    expect(transitions[0].toStage).toBe('guest')
    expect(transitions[0].reason).toBe('First booking')
    expect(transitions[0].approvedByIdentityId).toBe(admin.id)
    expect(transitions[1].fromStage).toBe('guest')
    expect(transitions[1].toStage).toBe('repeat')
  })

  it('should handle non-existent profile', async () => {
    const res = await POST(makeRequest({ to_stage: 'guest', reason: 'Test' }), {
      params: { profileId: 'non-existent-id' },
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

    const res = await POST(makeRequest({ to_stage: 'guest', reason: 'Test' }), {
      params: { profileId: testProfile.id },
    })

    expect(res.status).toBe(403)
  })
})
