import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/app/libs/onboardingGuard'
import { handleError } from '@/app/libs/errorHandler'
import { recordOwnerPayoutAtomic } from '@/modules/finance/payout-ledger.service'

export const dynamic = 'force-dynamic'

interface RecordOwnerPayoutRequest {
  statementId: string
  amountThb: number
  reference: string
  executedOn: string
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.error

  try {
    const body: RecordOwnerPayoutRequest = await req.json()

    if (!body.statementId || !body.amountThb || !body.reference || !body.executedOn) {
      return NextResponse.json(
        { error: 'Missing required fields: statementId, amountThb, reference, executedOn' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(body.amountThb) || body.amountThb <= 0) {
      return NextResponse.json({ error: 'amountThb must be a positive satang integer' }, { status: 400 })
    }

    const executedOn = new Date(body.executedOn)
    if (Number.isNaN(executedOn.getTime())) {
      return NextResponse.json({ error: 'executedOn must be a valid date' }, { status: 400 })
    }

    const statement = await prisma.ownerStatement.findUnique({
      where: { id: body.statementId },
      include: { unit: true },
    })

    if (!statement) return NextResponse.json({ error: 'Statement not found' }, { status: 404 })

    if (!['signed_off', 'published', 'distributed'].includes(statement.status)) {
      return NextResponse.json(
        { error: 'Only published/signed-off statements can have payouts recorded' },
        { status: 400 }
      )
    }

    if (body.amountThb !== statement.ownerShareTh) {
      return NextResponse.json(
        {
          error: 'Payout amount does not match the statement’s owner share',
          statementOwnerShareTh: statement.ownerShareTh,
        },
        { status: 400 }
      )
    }

    const existingPayout = await prisma.payout.findFirst({
      where: { ownerStatementId: body.statementId, payeeType: 'owner' },
    })
    if (existingPayout) {
      return NextResponse.json({ error: 'Payout already recorded for this statement' }, { status: 409 })
    }

    const payout = await recordOwnerPayoutAtomic(prisma, {
      ownerStatementId: body.statementId,
      unitId: statement.unitId,
      projectId: statement.unit.projectId,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
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
        amountThb: payout.amountThb,
        method: payout.method,
        reference: payout.reference,
        executedOn: payout.executedOn.toISOString().split('T')[0],
        status: payout.status,
        statementId: payout.ownerStatementId,
        createdAt: payout.createdAt.toISOString(),
      },
      message: `Owner payout recorded for ${statement.unit.name}: ฿${(payout.amountThb / 100).toLocaleString()}`,
    })
  } catch (error) {
    return handleError(error)
  }
}
