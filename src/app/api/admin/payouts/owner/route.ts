import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/app/libs/onboardingGuard'
import { handleError } from '@/app/libs/errorHandler'

export const dynamic = 'force-dynamic'

interface RecordOwnerPayoutRequest {
  statementId: string
  amountThb: number
  reference: string
  executedOn: string // ISO date string
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
      return NextResponse.json(
        { error: 'amountThb must be a positive satang integer' },
        { status: 400 }
      )
    }

    const executedOn = new Date(body.executedOn)
    if (Number.isNaN(executedOn.getTime())) {
      return NextResponse.json({ error: 'executedOn must be a valid date' }, { status: 400 })
    }

    const statement = await prisma.ownerStatement.findUnique({
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

    const payout = await prisma.$transaction(async (tx) => {
      // The database has a unique owner-statement payout guard as the final
      // concurrency barrier. The pre-check above is only for a friendly 409.
      const created = await tx.payout.create({
        data: {
          payeeType: 'owner',
          ownerStatementId: body.statementId,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          amountThb: body.amountThb,
          method: 'bank_transfer_thb',
          reference: body.reference,
          executedOn,
          recordedByIdentityId: guard.actorIdentityId,
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

      await tx.$executeRaw`
        INSERT INTO "ledger_entry" (
          "id", "entry_type", "amount_thb", "unit_id", "project_id",
          "statement_id", "occurred_on", "description", "created_by_identity_id", "payout_id"
        ) VALUES (
          ${randomUUID()}, CAST('payout_owner' AS "LedgerEntryType"), ${-body.amountThb},
          ${statement.unitId}, ${statement.unit.projectId}, ${statement.id}, ${executedOn},
          ${`Owner payout ${body.reference} for statement ${statement.id}`},
          ${guard.actorIdentityId}, ${created.id}
        )
      `

      return created
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
      message: `Owner payout recorded for ${payout.ownerStatement?.unit?.name}: ฿${(payout.amountThb / 100).toLocaleString()}`,
    })
  } catch (error) {
    return handleError(error)
  }
}
