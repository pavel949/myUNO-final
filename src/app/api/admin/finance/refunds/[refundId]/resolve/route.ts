import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { resolveFailedRefund } from '@/app/libs/payouts'

export const dynamic = 'force-dynamic'

interface ResolveRefundRequest {
  action: 'retry' | 'write_off'
}

export async function POST(
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

    if (!body.action || !['retry', 'write_off'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "retry" or "write_off".' },
        { status: 400 }
      )
    }

    const refund = await resolveFailedRefund(params.refundId, body.action)

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        status: refund.status,
        amountThb: refund.amountThb,
        reason: refund.reason,
      },
      message: `Refund ${body.action === 'retry' ? 'queued for retry' : 'written off'}: ฿${refund.amountThb.toLocaleString()}`,
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
