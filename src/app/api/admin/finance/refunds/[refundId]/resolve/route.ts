import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { resolveFailedRefund } from '@/app/libs/payouts'

export const dynamic = 'force-dynamic'

interface ResolveRefundRequest {
  action: 'retry' | 'write_off'
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { refundId: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body: ResolveRefundRequest = await req.json()
    const refundId = params.refundId

    if (!body.action || !['retry', 'write_off'].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be "retry" or "write_off"' },
        { status: 400 }
      )
    }

    const refund = await resolveFailedRefund(refundId, body.action)

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        status: refund.status,
        amountThb: refund.amountThb,
        reason: refund.reason,
      },
      message:
        body.action === 'write_off'
          ? `Refund written off: ฿${refund.amountThb.toLocaleString()}`
          : `Refund marked for retry: ฿${refund.amountThb.toLocaleString()}`,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Refund not found') {
      return NextResponse.json(
        { error: 'Refund not found' },
        { status: 404 }
      )
    }
    console.error('[RESOLVE REFUND]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
