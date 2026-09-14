import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/app/libs/onboardingGuard'
import { handleError } from '@/app/libs/errorHandler'
import { computeProviderRemittance } from '@/modules/finance'
import { recordProviderPayoutAtomic } from '@/modules/finance/payout-ledger.service'

export const dynamic = 'force-dynamic'

interface RecordProviderPayoutRequest {
  providerId: string
  periodStart: string
  periodEnd: string
  amountThb: number
  reference: string
  executedOn: string
}

/** Record a provider payout only from a settled canonical remittance snapshot. */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.error

  try {
    const body: RecordProviderPayoutRequest = await req.json()

    if (!body.providerId || !body.periodStart || !body.periodEnd || !body.amountThb || !body.reference || !body.executedOn) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, periodStart, periodEnd, amountThb, reference, executedOn' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(body.amountThb) || body.amountThb <= 0) {
      return NextResponse.json({ error: 'amountThb must be a positive satang integer' }, { status: 400 })
    }

    const provider = await prisma.provider.findUnique({ where: { id: body.providerId } })
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    const periodStart = new Date(body.periodStart)
    const periodEnd = new Date(body.periodEnd)
    const executedOn = new Date(body.executedOn)
    if (
      Number.isNaN(periodStart.getTime()) ||
      Number.isNaN(periodEnd.getTime()) ||
      Number.isNaN(executedOn.getTime()) ||
      periodStart >= periodEnd
    ) {
      return NextResponse.json({ error: 'Payout dates must be valid and periodStart must be before periodEnd' }, { status: 400 })
    }

    const remittance = await computeProviderRemittance(prisma, body.providerId, periodStart, periodEnd)

    if (remittance.pendingRefundCount > 0) {
      return NextResponse.json(
        {
          error: 'Provider payout is blocked while service-order refunds are unresolved',
          pendingRefundCount: remittance.pendingRefundCount,
          computed: remittance,
        },
        { status: 409 }
      )
    }

    if (remittance.netThb <= 0) {
      return NextResponse.json(
        { error: 'No positive provider payout is due for this period', computed: remittance },
        { status: 409 }
      )
    }

    if (body.amountThb !== remittance.netThb) {
      return NextResponse.json(
        { error: 'Payout amount does not match computed remittance', computed: remittance },
        { status: 400 }
      )
    }

    const existingPayout = await prisma.payout.findFirst({
      where: {
        providerId: body.providerId,
        payeeType: 'provider',
        periodStart,
        periodEnd,
      },
    })
    if (existingPayout) {
      return NextResponse.json({ error: 'Payout already recorded for this provider and period' }, { status: 409 })
    }

    const payout = await recordProviderPayoutAtomic(prisma, {
      providerId: body.providerId,
      periodStart,
      periodEnd,
      amountThb: body.amountThb,
      reference: body.reference,
      executedOn,
      recordedByIdentityId: guard.actorIdentityId,
    })

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        payeeType: payout.payeeType,
        providerId: payout.providerId,
        periodStart: payout.periodStart?.toISOString(),
        periodEnd: payout.periodEnd?.toISOString(),
        amountThb: payout.amountThb,
        method: payout.method,
        reference: payout.reference,
        executedOn: payout.executedOn.toISOString().split('T')[0],
        status: payout.status,
        createdAt: payout.createdAt.toISOString(),
      },
      remittanceDetails: remittance,
      message: `Provider payout recorded for ${provider.name}: ฿${(payout.amountThb / 100).toLocaleString()}`,
    })
  } catch (error) {
    return handleError(error)
  }
}
