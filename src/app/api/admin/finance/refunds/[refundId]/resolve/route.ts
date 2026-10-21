import { UI_LOCALE } from '@/lib/format';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { resolveFailedRefund } from '@/modules/finance';

export const dynamic = 'force-dynamic';

interface ResolveRefundRequest {
  action: 'retry' | 'write_off';
}

export async function POST(req: NextRequest, props: { params: Promise<{ refundId: string }> }) {
  const params = await props.params;
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
      message: `Refund ${refund.status}: ฿${(refund.amountThb / 100).toLocaleString(UI_LOCALE)}`,
    })
  } catch (error) {
    if ((error as { code?: string })?.code === 'REFUND_RESOLUTION_CONFLICT') {
      return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    }
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
