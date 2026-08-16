import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { computeProviderRemittance } from '@/app/libs/payouts'

export const dynamic = 'force-dynamic'

interface RecordProviderPayoutRequest {
  providerId: string
  periodStart: string // ISO date string
  periodEnd: string   // ISO date string
  amountThb: number
  reference: string
  executedOn: string  // ISO date string
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body: RecordProviderPayoutRequest = await req.json()

    if (!body.providerId || !body.periodStart || !body.periodEnd || !body.amountThb || !body.reference || !body.executedOn) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, periodStart, periodEnd, amountThb, reference, executedOn' },
        { status: 400 }
      )
    }

    if (body.amountThb <= 0) {
      return NextResponse.json(
        { error: 'amountThb must be positive' },
        { status: 400 }
      )
    }

    // Verify provider exists
    const provider = await prismadb.provider.findUnique({
      where: { id: body.providerId },
    })

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      )
    }

    const periodStart = new Date(body.periodStart)
    const periodEnd = new Date(body.periodEnd)

    if (periodStart >= periodEnd) {
      return NextResponse.json(
        { error: 'periodStart must be before periodEnd' },
        { status: 400 }
      )
    }

    // Verify amount matches computed remittance for this period
    const remittance = await computeProviderRemittance(
      body.providerId,
      periodStart,
      periodEnd
    )

    if (body.amountThb !== remittance.netThb) {
      return NextResponse.json(
        {
          error: 'Payout amount does not match computed remittance',
          computed: remittance,
        },
        { status: 400 }
      )
    }

    // Check if payout already exists for this period
    const existingPayout = await prismadb.payout.findFirst({
      where: {
        providerId: body.providerId,
        payeeType: 'provider',
        periodStart,
        periodEnd,
      },
    })

    if (existingPayout) {
      return NextResponse.json(
        { error: 'Payout already recorded for this provider and period' },
        { status: 409 }
      )
    }

    // Create the payout record
    const payout = await prismadb.payout.create({
      data: {
        payeeType: 'provider',
        providerId: body.providerId,
        periodStart,
        periodEnd,
        amountThb: body.amountThb,
        method: 'bank_transfer_thb',
        reference: body.reference,
        executedOn: new Date(body.executedOn),
        recordedByIdentityId: currentUser.identityId,
        status: 'recorded',
      },
      include: {
        provider: { select: { name: true } },
      },
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
      message: `Provider payout recorded for ${payout.provider?.name}: ฿${payout.amountThb.toLocaleString()}`,
    })
  } catch (error) {
    console.error('[PROVIDER PAYOUT]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
