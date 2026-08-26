import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reconcilePayout } from '@/modules/finance'

export const dynamic = 'force-dynamic'

export async function PUT(
  _req: NextRequest,
  { params }: { params: { payoutId: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 401 }
      )
    }

    const payoutId = params.payoutId

    // Mark payout as reconciled
    const payout = await reconcilePayout(prisma, payoutId)

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        status: payout.status,
        amountThb: payout.amountThb,
        executedOn: payout.executedOn.toISOString().split('T')[0],
      },
      message: `Payout marked as reconciled: ฿${payout.amountThb.toLocaleString()}`,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Payout not found') {
      return NextResponse.json(
        { error: 'Payout not found' },
        { status: 404 }
      )
    }
    console.error('[RECONCILE PAYOUT]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
