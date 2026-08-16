/* eslint-disable no-restricted-imports */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createUnitEngagement,
} from '@/test/util'
import type { OwnerStatementStatus } from '@prisma/client'

const mockGetCurrentUser = vi.fn()
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util')
  return { prisma: util.db }
})

import { PUT as ownerSignOff } from '../route'
import { PUT as adminSignOff } from '../../../../../admin/statements/[statementId]/sign-off/route'

function currentUser(
  identity: { id: string; email: string | null },
  isAdmin = false
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

function put(statementId: string, body?: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/owner/statements/${statementId}/sign-off`,
    {
      method: 'PUT',
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
          }),
    }
  )
}

describe('Owner statement sign-off (Q33)', () => {
  let owner: Awaited<ReturnType<typeof createIdentity>>
  let otherOwner: Awaited<ReturnType<typeof createIdentity>>
  let admin: Awaited<ReturnType<typeof createIdentity>>
  let unitId: string
  let engagementId: string

  async function createStatement(status: OwnerStatementStatus = 'published') {
    return db.ownerStatement.create({
      data: {
        unitId,
        ownerIdentityId: owner.id,
        engagementId,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        grossRevenueTh: 50_000,
        totalCostsTh: 10_000,
        noiTh: 40_000,
        ownerShareTh: 35_000,
        estateShareTh: 5_000,
        status,
      },
    })
  }

  beforeEach(async () => {
    await resetDb()

    owner = await createIdentity({ firstName: 'Statement', lastName: 'Owner' })
    otherOwner = await createIdentity({ firstName: 'Other', lastName: 'Owner' })
    admin = await createIdentity({ isAdmin: true })

    const project = await createProject({ name: 'Sign-off Project' })
    const unit = await createUnit({
      projectId: project.id,
      ownerIdentityId: owner.id,
    })
    unitId = unit.id

    const engagement = await createUnitEngagement({
      unitId: unit.id,
      ownerIdentityId: owner.id,
      status: 'active',
    })
    engagementId = engagement.id

    mockGetCurrentUser.mockResolvedValue(currentUser(owner))
  })

  it('requires authentication', async () => {
    const statement = await createStatement()
    mockGetCurrentUser.mockResolvedValue(null)

    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(401)
  })

  it('records the owner signature on their own statement', async () => {
    const statement = await createStatement()

    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statement.signedOffByOwnerAt).toBeTruthy()

    const stored = await db.ownerStatement.findUnique({
      where: { id: statement.id },
    })
    expect(stored?.signedOffByOwnerAt).toBeTruthy()
  })

  it('404s on another owner’s statement — scope is the query, not the UI', async () => {
    const statement = await createStatement()
    mockGetCurrentUser.mockResolvedValue(currentUser(otherOwner))

    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(404)

    const stored = await db.ownerStatement.findUnique({
      where: { id: statement.id },
    })
    expect(stored?.signedOffByOwnerAt).toBeNull()
  })

  it('404s on a draft statement — it has not passed the admin sign-off gate', async () => {
    const statement = await createStatement('draft')

    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(404)
  })

  it('404s on a statement that does not exist', async () => {
    const res = await ownerSignOff(put('no-such-statement'), {
      params: { statementId: 'no-such-statement' },
    })

    expect(res.status).toBe(404)
  })

  it('refuses a second owner signature', async () => {
    const statement = await createStatement()

    await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })
    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('already signed')
  })

  it('signs off the statement when the operator has already signed', async () => {
    const statement = await createStatement('pending_owner_review')
    await db.ownerStatement.update({
      where: { id: statement.id },
      data: { signedOffByOperatorAt: new Date() },
    })

    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.statement.status).toBe('signed_off')
    expect(data.statement.approvedAt).toBeTruthy()
  })

  it('shares its state machine with the admin route (operator signature)', async () => {
    const statement = await createStatement()

    // The owner signs through their own route…
    mockGetCurrentUser.mockResolvedValue(currentUser(owner))
    await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    // …and myUNO signs through the admin route, which closes the statement.
    mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))
    const res = await adminSignOff(put(statement.id, { actor: 'operator' }), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.statement.status).toBe('signed_off')
    expect(data.statement.approvedAt).toBeTruthy()
  })

  it('keeps the admin route’s offline path for an owner signature on paper', async () => {
    const statement = await createStatement()
    mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))

    const res = await adminSignOff(put(statement.id, { actor: 'owner' }), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.statement.signedOffByOwnerAt).toBeTruthy()
  })
})
