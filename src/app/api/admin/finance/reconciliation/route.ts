import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { getReconciliationData } from '@/app/libs/payouts'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const data = await getReconciliationData()

    return NextResponse.json({
      success: true,
      reconciliation: {
        unmatchedPaymentsCount: data.unmatchedPayments.length,
        failedRefundsCount: data.failedRefunds.length,
        pendingPayoutsCount: data.pendingPayouts.length,
        unmatchedPayments: data.unmatchedPayments,
        failedRefunds: data.failedRefunds,
        pendingPayouts: data.pendingPayouts,
      },
    })
  } catch (error) {
    console.error('[RECONCILIATION]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
