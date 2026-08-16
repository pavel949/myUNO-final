/* eslint-disable no-restricted-imports */
import { describe, it, expect, beforeEach, vi } from 'vitest'
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

// The page's two exits: a missing/foreign statement 404s, an anonymous visitor
// is sent to log in. Both throw in Next, so the test can assert on them.
class NotFoundSignal extends Error {}
class RedirectSignal extends Error {}

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundSignal('NEXT_NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new RedirectSignal(url)
  },
}))

import OwnerStatementDetailPage from '../page'

describe('Owner statement detail page — scoping', () => {
  let owner: Awaited<ReturnType<typeof createIdentity>>
  let otherOwner: Awaited<ReturnType<typeof createIdentity>>
  let unitId: string
  let engagementId: string

  function currentUser(identity: { id: string; email: string | null }) {
    return {
      identityId: identity.id,
      email: identity.email,
      firstName: 'Test',
      lastName: 'User',
      isAdmin: false,
      roles: [{ role: 'owner', projectId: null, unitId: null, organizationId: null, providerId: null }],
    }
  }

  async function createStatement(status: OwnerStatementStatus = 'published') {
    return db.ownerStatement.create({
      data: {
        unitId,
        ownerIdentityId: owner.id,
        engagementId,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        grossRevenueTh: 50_000,
        totalCostsTh: 16_000,
        noiTh: 34_000,
        ownerShareTh: 34_000,
        estateShareTh: 6_000,
        status,
        grossBookingsAmountTh: 50_000,
        guestPaymentsReceivedTh: 50_000,
        serviceFeesAmountTh: 6_000,
        operatingExpensesAmountTh: 10_000,
        taxesAmountTh: 0,
        adjustedNoiTh: 34_000,
        distributableCashTh: 34_000,
        performanceFeeAmountTh: 0,
        lineItems: {
          create: [
            {
              category: 'booking_revenue',
              description: 'Booking one',
              amountTh: 50_000,
            },
            {
              category: 'service_fee',
              description: 'myUNO service fee',
              amountTh: 6_000,
            },
          ],
        },
      },
    })
  }

  beforeEach(async () => {
    await resetDb()

    owner = await createIdentity({ firstName: 'Page', lastName: 'Owner' })
    otherOwner = await createIdentity({ firstName: 'Other', lastName: 'Owner' })

    const project = await createProject({ name: 'Statement Page Project' })
    const unit = await createUnit({
      projectId: project.id,
      ownerIdentityId: owner.id,
      name: 'B-707',
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

  it('renders the owner’s own statement with its line items', async () => {
    const statement = await createStatement()

    const element = await OwnerStatementDetailPage({
      params: { statementId: statement.id },
    })

    const props = (element as { props: Record<string, any> }).props
    expect(props.statement.id).toBe(statement.id)
    expect(props.statement.unitName).toBe('B-707')
    expect(props.statement.adjustedNoiTh).toBe(34_000)
    expect(props.statement.lines).toHaveLength(2)
    // Every user-facing string arrives as a resolved content key.
    expect(props.labels['owner.statement.gross_bookings']).toBeTruthy()
    expect(props.labels['common.line_item_category.service_fee']).toBeTruthy()
  })

  it('404s on a statement belonging to another owner', async () => {
    const statement = await createStatement()
    mockGetCurrentUser.mockResolvedValue(currentUser(otherOwner))

    await expect(
      OwnerStatementDetailPage({ params: { statementId: statement.id } })
    ).rejects.toBeInstanceOf(NotFoundSignal)
  })

  it('404s on a draft statement — it has not passed the sign-off gate', async () => {
    const statement = await createStatement('draft')

    await expect(
      OwnerStatementDetailPage({ params: { statementId: statement.id } })
    ).rejects.toBeInstanceOf(NotFoundSignal)
  })

  it('sends an anonymous visitor to log in', async () => {
    const statement = await createStatement()
    mockGetCurrentUser.mockResolvedValue(null)

    await expect(
      OwnerStatementDetailPage({ params: { statementId: statement.id } })
    ).rejects.toBeInstanceOf(RedirectSignal)
  })
})
