import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { resolveFailedRefund } from '@/modules/finance';

export const dynamic = 'force-dynamic';

interface ResolveRefundRequest {
  action: 'retry' | 'write_off';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { refundId: string } }
) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;

    const body: ResolveRefundRequest = await req.json()

    if (!body.action || !['retry', 'write_off'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "retry" or "write_off".' },
        { status: 400 }
      )
    }

    const refund = await resolveFailedRefund(prisma, params.refundId, body.action)

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
