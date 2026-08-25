import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface RecordOwnerPayoutRequest {
  statementId: string
  amountThb: number
  reference: string
  executedOn: string // ISO date string
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

    const body: RecordOwnerPayoutRequest = await req.json()

    if (!body.statementId || !body.amountThb || !body.reference || !body.executedOn) {
      return NextResponse.json(
        { error: 'Missing required fields: statementId, amountThb, reference, executedOn' },
        { status: 400 }
      )
    }

    if (body.amountThb <= 0) {
      return NextResponse.json(
        { error: 'amountThb must be positive' },
        { status: 400 }
      )
    }

    // Verify statement exists and is published
    const statement = await prismadb.ownerStatement.findUnique({
      where: { id: body.statementId },
      include: { unit: true },
    })

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    if (!['signed_off', 'published', 'distributed'].includes(statement.status)) {
      return NextResponse.json(
        { error: 'Only published/signed-off statements can have payouts recorded' },
        { status: 400 }
      )
    }

    // Q18: "amount = owner share" — the statement already carries the figure
    // this payout is meant to settle, so a typed amount that disagrees with
    // it is either a fat-fingered entry or a payout for the wrong statement.
    // Matches the same anti-tamper posture the provider payout route already
    // holds itself to (CLAUDE.md: client-sent amounts are never trusted).
    if (body.amountThb !== statement.ownerShareTh) {
      return NextResponse.json(
        {
          error: 'Payout amount does not match the statement’s owner share',
          statementOwnerShareTh: statement.ownerShareTh,
        },
        { status: 400 }
      )
    }

    // Check if payout already exists for this statement
    const existingPayout = await prismadb.payout.findFirst({
      where: {
        ownerStatementId: body.statementId,
        payeeType: 'owner',
      },
    })

    if (existingPayout) {
      return NextResponse.json(
        { error: 'Payout already recorded for this statement' },
        { status: 409 }
      )
    }

    // Create the payout record
    const payout = await prismadb.payout.create({
      data: {
        payeeType: 'owner',
        ownerStatementId: body.statementId,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        amountThb: body.amountThb,
        method: 'bank_transfer_thb',
        reference: body.reference,
        executedOn: new Date(body.executedOn),
        recordedByIdentityId: currentUser.identityId,
        status: 'recorded',
      },
      include: {
        ownerStatement: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            status: true,
            unit: { select: { name: true, projectId: true } },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        payeeType: payout.payeeType,
        amountThb: payout.amountThb,
        method: payout.method,
        reference: payout.reference,
        executedOn: payout.executedOn.toISOString().split('T')[0],
        status: payout.status,
        statementId: payout.ownerStatementId,
        createdAt: payout.createdAt.toISOString(),
      },
      message: `Owner payout recorded for ${payout.ownerStatement?.unit?.name}: ฿${payout.amountThb.toLocaleString()}`,
    })
  } catch (error) {
    console.error('[OWNER PAYOUT]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
