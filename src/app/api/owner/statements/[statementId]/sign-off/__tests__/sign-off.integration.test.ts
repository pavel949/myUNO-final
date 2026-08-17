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

  it('404s on a closed statement (signed_off)', async () => {
    const statement = await createStatement('signed_off')

    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(404)
  })

  it('404s on a closed statement (distributed)', async () => {
    const statement = await createStatement('distributed')

    const res = await ownerSignOff(put(statement.id), {
      params: { statementId: statement.id },
    })

    expect(res.status).toBe(404)
  })

  it('404s on a closed statement (superseded)', async () => {
    const statement = await createStatement('superseded')

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

  // A closed statement is finished. Signing it again would re-stamp approvedAt
  // and drag distributed/superseded back to signed_off — losing the record that
  // the money went out, or that a correction replaced this statement.
  describe('the admin route refuses to sign a closed statement', () => {
    const closed: OwnerStatementStatus[] = [
      'signed_off',
      'distributed',
      'superseded',
    ]

    for (const status of closed) {
      it(`refuses the operator signature on a ${status} statement`, async () => {
        const statement = await createStatement(status)
        mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))

        const res = await adminSignOff(
          put(statement.id, { actor: 'operator' }),
          { params: { statementId: statement.id } }
        )

        expect(res.status).toBe(409)

        const stored = await db.ownerStatement.findUnique({
          where: { id: statement.id },
        })
        expect(stored?.status).toBe(status)
        expect(stored?.signedOffByOperatorAt).toBeNull()
        expect(stored?.approvedAt).toBeNull()
      })
    }

    it('does not re-stamp approvedAt on an already signed_off statement', async () => {
      const approvedAt = new Date('2026-07-01T00:00:00.000Z')
      const statement = await createStatement('signed_off')
      await db.ownerStatement.update({
        where: { id: statement.id },
        data: { signedOffByOwnerAt: approvedAt, approvedAt },
      })

      mockGetCurrentUser.mockResolvedValue(currentUser(admin, true))
      const res = await adminSignOff(put(statement.id, { actor: 'operator' }), {
        params: { statementId: statement.id },
      })

      expect(res.status).toBe(409)

      const stored = await db.ownerStatement.findUnique({
        where: { id: statement.id },
      })
      expect(stored?.approvedAt?.toISOString()).toBe(approvedAt.toISOString())
    })
  })

  // Both signatures arriving together each read "the other side hasn't signed".
  // Without the row lock both write without the signed_off transition, and the
  // statement ends up fully signed but still marked as waiting, with no
  // approvedAt — a statement that can never close.
  it('closes the statement when both signatures race each other', async () => {
    const statement = await createStatement()

    const ownerUser = currentUser(owner)
    const adminUser = currentUser(admin, true)
    let call = 0
    // The two requests interleave: each resolves its own actor's session.
    mockGetCurrentUser.mockImplementation(() =>
      Promise.resolve(call++ % 2 === 0 ? ownerUser : adminUser)
    )

    const [ownerRes, adminRes] = await Promise.all([
      ownerSignOff(put(statement.id), {
        params: { statementId: statement.id },
      }),
      adminSignOff(put(statement.id, { actor: 'operator' }), {
        params: { statementId: statement.id },
      }),
    ])

    expect(ownerRes.status).toBe(200)
    expect(adminRes.status).toBe(200)

    const stored = await db.ownerStatement.findUnique({
      where: { id: statement.id },
    })
    expect(stored?.signedOffByOwnerAt).toBeTruthy()
    expect(stored?.signedOffByOperatorAt).toBeTruthy()
    // The loser of the race saw the winner's signature and closed the statement.
    expect(stored?.status).toBe('signed_off')
    expect(stored?.approvedAt).toBeTruthy()
  })

  it('records only one signature when the same actor signs twice at once', async () => {
    const statement = await createStatement()
    mockGetCurrentUser.mockResolvedValue(currentUser(owner))

    const results = await Promise.all([
      ownerSignOff(put(statement.id), {
        params: { statementId: statement.id },
      }),
      ownerSignOff(put(statement.id), {
        params: { statementId: statement.id },
      }),
    ])

    const codes = results.map((r) => r.status).sort()
    expect(codes).toEqual([200, 409])
  })
})
